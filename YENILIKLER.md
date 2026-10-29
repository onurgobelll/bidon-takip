# Bidon Takip v4.0 Pro — Saha Hızlandırıcı ve ERP Seviyesi Güncelleme

Bu sürümle birlikte sistem bir "veri giriş aracı" olmaktan çıkıp, endüstriyel tesisler için tam teşekküllü bir **Saha ve Envanter Yönetim Sistemine (ERP Modülü)** dönüştürülmüştür.

## v4.0 Pro İle Eklenen Temel Özellikler

### 1. ⚡ Seri Parti Sabitleme Modu
- Aynı parti/tarihli 50-100 bidon geldiğinde ilk bidon okutulup **"📌 Seri Parti Modu"** butonuna basılır.
- Sonraki bidonlarda telefon işlemcisini yoran OCR (etiket okuma) tamamen devreden çıkar; sistem sadece milisaniyeler içinde QR okuyarak sabit bilgileri anında işler.
- Pil tüketimi neredeyse sıfıra iner, tarama hızı 10 kat artar.

### 2. 🎯 Akıllı QR-Üstü Kırpma & Otomatik Flaş
- Kamera tam kareden etiket aramak yerine, QR kodunun koordinatlarını referans alarak etiketin bulunduğu üst alanı odaklar.
- Ortam loş veya karanlık olduğunda kamera karesinin luma (parlaklık) değeri ölçülerek telefonun flaşı (`torch`) otomatik açılır ve kapatılır.

### 3. 🔋 Cihaz Eğim Sensörü ile Otomatik Pil Tasarrufu
- Operatör paletler arasında yürürken telefonu aşağı indirdiğinde (`DeviceOrientation` sensörü ile) kamera akışı otomatik uyku moduna (`💤 Uyku Perdesi`) geçer.
- Telefon bidona tekrar doğrultulduğu an kamera milisaniyeler içinde uyanır.

### 4. 🔊 Çift Tonlu Melodik Ses ve Titreşim Bildirimleri
- Güneş altında ekrana bakma zorunluluğu ortadan kaldırıldı:
  - **Başarılı işlem:** 2 tonlu melodik onay sesi ve tek titreşim.
  - **Hatalı işlem:** Kalın buzzer tonu ve çift titreşim.
  - **FIFO Uyarısı:** Özel çift ikaz tonu.

### 5. ⚠️ FIFO (İlk Giren İlk Çıkar) Yaşlandırma Uyarısı
- Üretime **Çıkış** yapılırken, sahada aynı üründen daha eski tarihli bir bidon bekliyorsa operatör sesli ve görsel ikazla uyarılır: *"Dikkat: M1 bölgesinde daha eski tarihli (13.08.2026) bidon var!"*

### 6. 🗺️ 2D Görsel Saha Haritası (Isı Haritası)
- Stok ekranında tüm bölgeler (M1, Y2, Z5 vb.) görsel kutular halinde listelenir.
- Doluluk oranına göre renk kodlaması yapılır (Yeşil: Boş, Turuncu: Orta, Kırmızı: Yoğun).
- Bölge kutusuna dokunulduğunda içindeki ürün adetleri ve en eski dolum tarihi anında açılır.

### 7. 📋 Bölge Sayım (Envanter Mutabakat) Modu
- Sayım modunda bir bölgenin QR'ı okutularak o bölgedeki bidonlar seri taranır.
- Sistem Google Sheet'teki kayıtla sahadaki fiziksel sayımı karşılaştırarak **Eksik** ve **Nakil/Fazla** bidonları tespit eder.

### 8. 🔎 Parti / Lot İzlenebilirlik (Traceability) Raporu
- Arama kutusuna mamul parti numarası (örn. `P-2026-105`) girildiğinde, o partide kullanılan tüm bidonların ürün, menşe, personel ve tarih dökümü saniyesinde çıkarılır. BRCGS / IFS kalite denetimleri için tek tıkla Excel'e aktarılabilir.

### 9. 🧠 Kendi Kendini Geliştiren Google Sheet Sözlüğü
- Sahada yapılan operatör düzeltmeleri Google Sheet'e (`DUZELTME_GUNLUGU`) yazılır. 2 kez tekrarlanan düzeltmeler otomatik olarak `ESLESTIRME_SOZLUGU`'ne kaydedilir ve sonraki taramalarda sistem hatayı yapmadan doğru değeri tanır.

---

## Kurulum ve Dağıtım Adımları

1. **Google Apps Script Güncellemesi:**
   - Google Sheet'inizde **Uzantılar > Apps Script** bölümünü açın.
   - `Kod.gs` dosyasının içindekileri silip güncel `Kod.gs` içeriğini yapıştırın ve Kaydet simgesine basın.
   - Sağ üstteki mavi **Dağıt > Dağıtımları yönet** butonuna tıklayın.
   - Kalem (Düzenle) simgesine basın, Sürüm olarak **"Yeni sürüm"** seçin ve **Dağıt**'a tıklayın.

2. **GitHub Pages Güncellemesi:**
   - GitHub'da deponuza gidin.
   - **Add file > Upload files** butonuna tıklayın.
   - Paketteki `index.html`, `sw.js`, `manifest.json` dosyalarını sürükleyip bırakın ve **Commit changes** diyerek onaylayın.
   - 1-2 dakika içinde GitHub Pages otomatik güncellenecektir. Telefonda sayfayı bir kez yenilemeniz yeterlidir.
