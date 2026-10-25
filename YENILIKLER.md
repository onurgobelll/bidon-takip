# Bidon Takip v3.0 — Operasyon paneli tasarım yenilemesi

Bu paket mevcut uygulamanın işlevlerini korur. Güncellenen dosyalar `index.html`, `manifest.json` ve `sw.js` dosyalarıdır. QR, OCR, toplu giriş, Google Sheets bağlantısı, çevrimdışı kuyruk, stok raporu ve yedekleme Apps Script dosyası korunmuştur.

## Bu sürümde
- Markalı başlık, operasyon özeti ve responsive stok kartları eklendi.
- Tarama, elle giriş ve galeriden seçme işlemleri görsel önceliğe göre yeniden düzenlendi.
- Alt gezinmeye ikonlar eklendi; tipografi, boşluklar ve renk sistemi mobil/masaüstü için yenilendi.
- Stok sayfasına ürün bazında toplam ve sahada/üretimde dağılım grafikleri, bölge grafiği ve günlük hareket özetleri eklendi.
- Excel raporları açılır bölüme taşındı; ana stok görünümü sade tutuldu.
- Masaüstünde sol menü ve geniş çalışma alanı, telefonda ikonlu alt menü ile uygulama genelinde ortak bir tasarım sistemi kuruldu.
- PWA önbellek sürümü artırıldı; yeni arayüz kurulumlarda eski önbellekle çakışmaz.

## Mevcut GitHub Pages sitesini güncelleme
1. Önce mevcut dosyaların bir kopyasını saklayın.
2. Bu arşivdeki dosyaları GitHub deposunun kök dizinine yükleyin ve mevcut dosyaların üzerine yazın.
3. `index.html`, `manifest.json` ve `sw.js` değişikliklerini yayımlayın. `Kod.gs` değişmediği için Apps Script dağıtımını güncellemeniz gerekmez.
4. Telefonda uygulamayı kapatıp yeniden açın. Güncelleme görünmezse siteyi tarayıcıda bir kez yenileyin.

Uygulama GitHub Pages'e bu paket üzerinden otomatik yayımlanmadı; değişiklikler indirilebilir dosyalarda hazırlandı.
