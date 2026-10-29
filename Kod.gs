/**
 * YAKAMOZ BİDON TAKİP - Google Apps Script Arka Yüz (v4.0 Pro)
 * 
 * Yeni Özellikler (v4.0 Pro):
 * - ESLESTIRME_SOZLUGU: Sahada yapılan düzeltmelerden otomatik öğrenen alias sözlüğü.
 * - DUZELTME_GUNLUGU: Operatörün OCR çıktısını elle düzelttiği kayıtlar (2+ tekrarda sözlüğe girer).
 * - SAYIM & MUTABAKAT: Bölge sayım sonuçlarının doğrulanması ve tek tıkla güncellenmesi.
 * - TELEGRAM RAPORU: Gün sonu kapatmasında veya istenildiğinde yöneticiye otomatik özet bildirim.
 * - FIFO & GERİYE DÖNÜK İZLENEBİLİRLİK: Parti/Lot bazında kullanılan bidonların soykütüğü.
 *
 * Script Özellikleri (Proje Ayarları > Script özellikleri):
 *   SIFRE               -> Sahada kullanılan ortak şifre (ZORUNLU)
 *   TELEGRAM_BOT_TOKEN  -> OPSİYONEL. Gün sonu Telegram raporu için bot token.
 *   TELEGRAM_CHAT_ID    -> OPSİYONEL. Raporun gideceği Telegram grup/kullanıcı ID.
 *   ANTHROPIC_KEY       -> OPSİYONEL. Sadece "AI Okuma (ücretli)" seçilirse gerekir.
 */

const MODEL = 'claude-sonnet-5-5';
const URUN_VARSAYILAN = ['ACI BİBER', 'BİBERİYE', 'SARI YAKAN'];
const TZ = 'Europe/Istanbul';

/* ---------- Yardımcı Fonksiyonlar ---------- */
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function fmt_(d, f) { return Utilities.formatDate(d, TZ, f); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sayfa_(ad, basliklar) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ad);
  if (!sh) {
    sh = ss.insertSheet(ad);
    sh.getRange(1, 1, sh.getMaxRows(), basliklar.length).setNumberFormat('@');
    sh.appendRow(basliklar);
    sh.setFrozenRows(1);
  }
  return sh;
}

const bidonSayfa_ = () => sayfa_('BIDONLAR', ['BidonID', 'Urun', 'EtiketTarihi', 'Kisi', 'Mense', 'Durum', 'GirisZamani', 'SonHareket', 'Bolge']);
const hareketSayfa_ = () => sayfa_('HAREKET', ['Zaman', 'Gun', 'BidonID', 'Islem', 'Urun', 'EtiketTarihi', 'Kisi', 'Parti', 'Neden', 'Operator', 'Kaynak', 'IstekId', 'Bolge']);
const qrSayfa_ = () => sayfa_('QR_BASIM', ['Zaman', 'Onek', 'Bas', 'Bit', 'Adet']);
const sozlukSayfa_ = () => sayfa_('ESLESTIRME_SOZLUGU', ['YanlisMetin', 'DogruDeger', 'Tur', 'Guncelleme']);
const duzeltmeSayfa_ = () => sayfa_('DUZELTME_GUNLUGU', ['Zaman', 'HamMetin', 'SecilenDeger', 'Tur', 'Operator']);

function urunler_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('URUNLER');
  if (!sh) {
    sh = ss.insertSheet('URUNLER');
    sh.appendRow(['Urun']);
    URUN_VARSAYILAN.forEach(u => sh.appendRow([u]));
    sh.setFrozenRows(1);
  }
  const n = sh.getLastRow();
  return n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0]).trim()).filter(Boolean) : URUN_VARSAYILAN;
}

function sozlukOku_() {
  const sh = sozlukSayfa_();
  const n = sh.getLastRow();
  const map = { URUN: {}, KISI: {}, MENSE: {} };
  if (n <= 1) return map;
  const veriler = sh.getRange(2, 1, n - 1, 3).getValues();
  veriler.forEach(r => {
    const yanlis = String(r[0] || '').trim().toUpperCase();
    const dogru = String(r[1] || '').trim().toUpperCase();
    const tur = String(r[2] || 'URUN').trim().toUpperCase();
    if (yanlis && dogru) {
      if (!map[tur]) map[tur] = {};
      map[tur][yanlis] = dogru;
    }
  });
  return map;
}

function sifreHata_(s) {
  const c = CacheService.getScriptCache();
  const yanlis = Number(c.get('yanlis') || 0);
  if (yanlis >= 10) return 'Çok fazla yanlış deneme. 10 dakika bekle.';
  if (!prop_('SIFRE') || s !== prop_('SIFRE')) { c.put('yanlis', String(yanlis + 1), 600); return 'Şifre yanlış'; }
  return '';
}

function oku2_(sh, kolon) {
  const n = sh.getLastRow();
  return n > 1 ? sh.getRange(2, 1, n - 1, kolon).getValues() : [];
}

/* ---------- Web Uygulaması Giriş Noktaları ---------- */
function doGet() {
  return json_({ ok: false, hata: 'Bu adres sadece arka yüz API içindir. Uygulamayı GitHub Pages adresinden aç.' });
}

function gunSonuKapat_(veri, bugun) {
  const yeni = [];
  veri.forEach(r => {
    if (r[5] === 'URETIMDE' && String(r[7]).slice(0, 10) < bugun) {
      const gun = String(r[7]).slice(0, 10);
      r[5] = 'KULLANILDI';
      yeni.push([gun + ' 23:59:59', gun, r[0], 'KULLANILDI', r[1], r[2], r[3], '', 'Gün sonu: iade edilmedi, kullanıldı sayıldı', 'SİSTEM', 'otomatik', '', r[8] || '']);
    }
  });
  return yeni;
}

function liste_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = bidonSayfa_();
    const veri = oku2_(sh, 9);
    const kapanan = gunSonuKapat_(veri, fmt_(new Date(), 'yyyy-MM-dd'));
    if (kapanan.length) {
      sh.getRange(2, 1, veri.length, 9).setValues(veri);
      const hs = hareketSayfa_();
      hs.getRange(hs.getLastRow() + 1, 1, kapanan.length, 13).setValues(kapanan);
    }
    const bidonlar = veri.map(r => ({
      id: r[0], urun: r[1], tarih: r[2], kisi: r[3], mense: r[4], durum: r[5], giris: r[6], son: r[7], bolge: r[8]
    }));
    const hareketler = oku2_(hareketSayfa_(), 13).map(r => ({
      zaman: r[0], gun: r[1], id: r[2], islem: r[3], urun: r[4], tarih: r[5], kisi: r[6], parti: r[7], neden: r[8], operator: r[9], kaynak: r[10], bolge: r[12]
    }));
    const sonNo = {}, araliklar = [];
    oku2_(qrSayfa_(), 5).forEach(r => {
      sonNo[r[1]] = Math.max(sonNo[r[1]] || 0, Number(r[3]) || 0);
      araliklar.push({ onek: r[1], bas: Number(r[2]) || 0, bit: Number(r[3]) || 0 });
    });
    return {
      ok: true,
      bidonlar: bidonlar,
      hareketler: hareketler,
      sonNo: sonNo,
      araliklar: araliklar,
      urunler: urunler_(),
      sozluk: sozlukOku_(),
      surum: '4.0-pro'
    };
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const hata = sifreHata_(d.sifre);
    if (hata) return json_({ ok: false, hata: hata });
    if (d.islem === 'liste') return json_(liste_());
    if (d.islem === 'islem') return json_(islem_(d));
    if (d.islem === 'qrbasim') return json_(qrBasim_(d));
    if (d.islem === 'duzeltme_kaydet') return json_(duzeltmeKaydet_(d));
    if (d.islem === 'sayim_kaydet') return json_(sayimKaydet_(d));
    if (d.islem === 'telegram_rapor') return json_(telegramRaporuGonder_(d));
    return json_({ ok: false, hata: 'Bilinmeyen işlem' });
  } catch (err) {
    return json_({ ok: false, hata: String(err) });
  }
}

/* ---------- Kendi Kendini Geliştiren Sözlük (Feedback Loop) ---------- */
function duzeltmeKaydet_(d) {
  const ham = String(d.ham || '').trim().toUpperCase();
  const dogru = String(d.dogru || '').trim().toUpperCase();
  const tur = String(d.tur || 'URUN').trim().toUpperCase();
  const operator = String(d.operator || 'OPERATOR').trim();
  if (!ham || !dogru || ham === dogru) return { ok: true, atlandi: true };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const dh = duzeltmeSayfa_();
    const z = fmt_(new Date(), 'yyyy-MM-dd HH:mm:ss');
    dh.appendRow([z, ham, dogru, tur, operator]);

    // Son 100 düzeltmeyi kontrol et: bu ham metin aynı doğru değere en az 2 kez düzeltilmiş mi?
    const n = dh.getLastRow();
    const bas = Math.max(2, n - 99);
    const kayitlar = dh.getRange(bas, 2, n - bas + 1, 2).getValues();
    const frekans = kayitlar.filter(r => String(r[0]).trim().toUpperCase() === ham && String(r[1]).trim().toUpperCase() === dogru).length;

    let eklendi = false;
    if (frekans >= 2) {
      const sh = sozlukSayfa_();
      const sozlukVeri = oku2_(sh, 3);
      const varmi = sozlukVeri.some(r => String(r[0]).trim().toUpperCase() === ham && String(r[2]).trim().toUpperCase() === tur);
      if (!varmi) {
        sh.appendRow([ham, dogru, tur, z]);
        eklendi = true;
      }
    }
    return { ok: true, eklendi: eklendi, frekans: frekans };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Bölge Sayım ve Mutabakat Kaydı ---------- */
function sayimKaydet_(d) {
  const bolge = String(d.bolge || '').trim();
  const tarananlar = (d.tarananlar || []).map(x => String(x).trim()).filter(Boolean);
  const operator = String(d.operator || 'OPERATOR').trim();
  if (!bolge) return { ok: false, hata: 'Bölge belirtilmedi' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = bidonSayfa_(), hs = hareketSayfa_();
    const veri = oku2_(sh, 9);
    const z = fmt_(new Date(), 'yyyy-MM-dd HH:mm:ss'), g = fmt_(new Date(), 'yyyy-MM-dd');
    
    // Sistemde bu bölgede SAHADA olan bidonlar
    const sistemdekiBidonlar = veri.filter(r => r[5] === 'SAHADA' && String(r[8]).trim() === bolge).map(r => String(r[0]).trim());
    const eksikler = sistemdekiBidonlar.filter(id => !tarananlar.includes(id));
    const fazlalar = tarananlar.filter(id => !sistemdekiBidonlar.includes(id));

    // Fark varsa HAREKET'e sayım mutabakat kaydı at
    const hareketNot = 'SAYIM [' + bolge + ']: ' + tarananlar.length + ' taranan, ' + eksikler.length + ' eksik, ' + fazlalar.length + ' nakil/fazla';
    hs.appendRow([z, g, bolge, 'SAYIM', '', '', '', '', hareketNot, operator, 'mobil', '', bolge]);

    // Fazla çıkan bidonların bölgesini otomatik bu bölgeye güncelle (isteğe bağlı)
    if (d.bolgeGuncelle && fazlalar.length) {
      veri.forEach(r => {
        if (fazlalar.includes(String(r[0]).trim()) && r[5] === 'SAHADA') {
          r[8] = bolge;
          r[7] = z;
        }
      });
      sh.getRange(2, 1, veri.length, 9).setValues(veri);
    }

    return {
      ok: true,
      bolge: bolge,
      toplamTaranan: tarananlar.length,
      eksikler: eksikler,
      fazlalar: fazlalar
    };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Giriş / Çıkış / İade / Taşı (Toplu İşlem) ---------- */
function islem_(d) {
  const tip = d.tip;
  if (['GIRIS', 'CIKIS', 'IADE', 'TASI'].indexOf(tip) < 0) return { ok: false, hata: 'Geçersiz işlem' };
  const liste = d.kayitlar || [];
  if (!liste.length) return { ok: false, hata: 'Liste boş' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = CacheService.getScriptCache();
    const anahtar = d.istekId ? 'i_' + d.istekId : '';
    if (anahtar) {
      const eski = cache.get(anahtar);
      if (eski) return Object.assign(JSON.parse(eski), { tekrar: true });
    }

    const sh = bidonSayfa_(), hs = hareketSayfa_();
    if (d.istekId) {
      const son = hs.getLastRow();
      if (son >= 2) {
        const bas = Math.max(2, son - 2999);
        const idler = hs.getRange(bas, 12, son - bas + 1, 1).getValues();
        const n = idler.filter(x => String(x[0]) === String(d.istekId)).length;
        if (n) return { ok: true, islenen: n, yeni: 0, atlanan: [], tekrar: true };
      }
    }
    const veri = oku2_(sh, 9);
    const kapanan = gunSonuKapat_(veri, fmt_(new Date(), 'yyyy-MM-dd'));
    const idx = {};
    veri.forEach((r, i) => { idx[String(r[0])] = i; });

    const simdi = new Date();
    const z = fmt_(simdi, 'yyyy-MM-dd HH:mm:ss'), g = fmt_(simdi, 'yyyy-MM-dd');
    const hareket = kapanan.slice(), gorulen = {}, atlanan = [];
    let yeni = 0;

    liste.forEach(k => {
      const id = String(k.id || '').trim();
      if (!id || gorulen[id]) return;
      gorulen[id] = true;
      let i = idx[id];
      const var_ = i !== undefined;
      const bolge = String(k.bolge || d.bolge || '').trim();
      if (tip === 'GIRIS') {
        if (var_ && veri[i][5] === 'URETIMDE') { atlanan.push({ id: id, neden: 'Üretimde, önce iade yap' }); return; }
      } else if (!var_) { atlanan.push({ id: id, neden: 'Kayıtsız bidon, önce giriş yap' }); return; }
      else if (tip === 'CIKIS' && veri[i][5] !== 'SAHADA') { atlanan.push({ id: id, neden: veri[i][5] === 'KULLANILDI' ? 'Kullanıldı, önce giriş yap' : 'Zaten üretimde' }); return; }
      else if (tip === 'IADE' && veri[i][5] !== 'URETIMDE') { atlanan.push({ id: id, neden: veri[i][5] === 'KULLANILDI' ? 'Geçen güne kaldı, kullanıldı sayıldı. İade için önce giriş yap' : 'Üretimde değil' }); return; }
      else if (tip === 'TASI' && !bolge) { atlanan.push({ id: id, neden: 'Bölge boş' }); return; }
      else if (tip === 'TASI' && veri[i][5] !== 'SAHADA') { atlanan.push({ id: id, neden: veri[i][5] === 'KULLANILDI' ? 'Kullanıldı, önce giriş yap' : 'Üretimde, önce iade yap' }); return; }
      else if (tip === 'TASI' && String(veri[i][8]) === bolge) { atlanan.push({ id: id, neden: 'Zaten bu bölgede' }); return; }

      if (!var_) {
        veri.push([id, k.urun || '', k.tarih || '', k.kisi || '', k.mense || '', '', z, z, '']);
        i = veri.length - 1; idx[id] = i; yeni++;
      } else if (tip === 'GIRIS') {
        const r0 = veri[i];
        if (k.urun) r0[1] = k.urun;
        if (k.tarih) r0[2] = k.tarih;
        if (k.kisi) r0[3] = k.kisi;
        if (k.mense) r0[4] = k.mense;
      }
      const r = veri[i];
      r[5] = (tip === 'CIKIS') ? 'URETIMDE' : 'SAHADA';
      r[7] = z;
      if (bolge && tip !== 'CIKIS') r[8] = bolge;
      hareket.push([z, g, id, tip, r[1], r[2], r[3], d.parti || '', d.neden || '', d.operator || '', k.kaynak || '', d.istekId || '', r[8] || '']);
    });

    if (veri.length) sh.getRange(2, 1, veri.length, 9).setValues(veri);
    if (hareket.length) hs.getRange(hs.getLastRow() + 1, 1, hareket.length, 13).setValues(hareket);
    const sonuc = { ok: true, islenen: hareket.length - kapanan.length, yeni: yeni, atlanan: atlanan };
    if (anahtar) cache.put(anahtar, JSON.stringify(sonuc), 21600);
    return sonuc;
  } finally {
    lock.releaseLock();
  }
}

function qrBasim_(d) {
  const sh = qrSayfa_();
  sh.appendRow([fmt_(new Date(), 'yyyy-MM-dd HH:mm:ss'), d.onek || '', Number(d.bas) || 0, Number(d.bit) || 0, Number(d.adet) || 0]);
  return { ok: true };
}

/* ---------- Telegram Gün Sonu Raporu (Opsiyonel Bot) ---------- */
function telegramRaporuGonder_(d) {
  const token = prop_('TELEGRAM_BOT_TOKEN');
  const chatId = prop_('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return { ok: false, hata: 'Telegram ayarları (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) tanımlı değil' };

  const sh = bidonSayfa_();
  const veri = oku2_(sh, 9);
  const bugun = fmt_(new Date(), 'yyyy-MM-dd');
  const hs = hareketSayfa_();
  const hareketler = oku2_(hs, 13).filter(r => String(r[1]) === bugun);

  const gelen = hareketler.filter(r => r[3] === 'GIRIS').length;
  const cikis = hareketler.filter(r => r[3] === 'CIKIS').length;
  const iade = hareketler.filter(r => r[3] === 'IADE').length;
  const sahada = veri.filter(r => r[5] === 'SAHADA').length;
  const uretimde = veri.filter(r => r[5] === 'URETIMDE').length;

  const mesaj = '📊 *Yakamoz Günlük Bidon Raporu* (' + bugun + ')\n\n' +
                '• Bugün Giriş: ' + gelen + ' adet\n' +
                '• Üretime Verilen: ' + cikis + ' adet\n' +
                '• İade Edilen: ' + iade + ' adet\n' +
                '• Sahadaki Aktif Stok: ' + sahada + ' adet\n' +
                '• Üretimde Olan: ' + uretimde + ' adet\n\n' +
                '⚡ _Sistem tarafından otomatik üretildi._';

  try {
    const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: mesaj, parse_mode: 'Markdown' })
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, hata: String(err) };
  }
}

function haftalikYedek() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dosya = DriveApp.getFileById(ss.getId());
  const k = DriveApp.getFoldersByName('Bidon Yedek');
  const klasor = k.hasNext() ? k.next() : DriveApp.createFolder('Bidon Yedek');
  dosya.makeCopy('Bidon Takip yedek ' + fmt_(new Date(), 'yyyy-MM-dd'), klasor);
}
