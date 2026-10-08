# Meriç-Tunca-Arda Sınıraşan Havzaları SWOT Uydu & Hibrit ML Nehir Akım ve Taşkın İzleme Portalı

Bulgaristan'dan Türkiye'ye geçen sınıraşan akarsular (**Meriç, Tunca ve Arda**) üzerinde **NASA/CNES SWOT (Surface Water and Ocean Topography)** uydu verilerini, açık kaynaklı meteorolojik verileri (ERA5-Land) ve yerel ölçüm istasyonlarını (**DSİ 11. Bölge Edirne Portalı**) birleştiren, gerçek zamanlıya yakın çalışan, etkileşimli bir **Nehir Seviyesi, Akım ve Taşkın Erken Uyarı Web Uygulaması**.

Uygulama, **Kızılırmak Havzası SWOT Nehir Akım Analizi** metodolojisini temel alarak; SWOT uydusunun döngüsel (~11-21 günlük) gözlemlerini gecikmeli meteorolojik değişkenler ve Makine Öğrenmesi (Random Forest / LightGBM) ile **kesintisiz (günlük) akış hidrograflarına** dönüştürür.

---

## 🚀 Temel Özellikler

1. **İnteraktif Sınıraşan Havza Haritası (Leaflet.js):**
   - Bulgaristan ve Türkiye sınırları, SWORD v17c nehir segmentleri (`reach_id`, `node_id`).
   - DSİ 11. Bölge Akım Gözlem İstasyonları (Kirişhane, İpsala, Suakacağı, Değirmenyeni, Arda Köprüsü).
   - Bulgaristan memba barajları (Ivaylovgrad, Studen Kladenets, Kardzhali, Zhrebchevo, Koprinka).
   - Taşkın seviyesine göre renk kodlama (Yeşil: Normal, Sarı: İkaz, Kırmızı: Taşkın Riski).
2. **Hidrolojik Zaman Serisi ve Analiz Paneli (Plotly.js):**
   - Yer AGİ debisi, SWOT L4 anlık geçiş noktaları ve ML süreklileştirilmiş akış eğrisi.
   - Havza yağış hyetografı (ters çevrilmiş yağış çubukları).
   - Dinamik Doğrulama Metrikleri: **RMSE**, Pearson **$r$**, **NSE** (Nash-Sutcliffe Efficiency) ve **KGE** (Kling-Gupta Efficiency).
3. **Membadan Mansaba Sırt Çizgisi (Longitudinal Ridgeline) Profili:**
   - Bulgaristan sınırından Ege Denizi döküm noktasına (Enez) kadar akım ve su yüzeyi kotu (WSE) sürekliliği.
4. **Sınıraşan Taşkın Erken Uyarı & Lead-Time (Varış Süresi) Modülü:**
   - Bulgaristan memba baraj salımları ve sınır ötesi debi dalgalarının Edirne AGİ istasyonlarına tahmini varış süresi (Lead Time) hesaplaması.
5. **SWOT Kalite Kontrol (QC) Simülatörü:**
   - Genişlik eşiği (< 50-80 m), kalite bayrağı (`reach_q > 1`), yükseklik belirsizliği (`wse_u > 1.0 m`) ve IQR kutu grafiği aykırı değer temizleme.

---

## 📐 Hidrolojik Algoritmalar ve Formülasyonlar

### 1. SWORD Segment Kalite Kontrolü (QC) & Filtreleme
- Genişliği ortalama $< 50\text{ m}$ olan KaRIn radar layover gürültülü segmentleri elenir.
- Kalite bayrağı: `reach_q > 1` ve kot belirsizliği $\text{wse\_u} > 1.0\text{ m}$ olan gözlemler filtrelenir.
- Kutu grafiği (IQR) yöntemi ile ekstrem aykırı değerler temizlenir:
  $$[Q_1 - 1.5 \times \text{IQR}, \; Q_3 + 1.5 \times \text{IQR}]$$

### 2. Düşey Datum ve Eşel Kotu (Bias) Düzeltmesi
SWOT WGS84/EGM2008 elipsoit kotu ile yersel DSİ istasyon eşel kotu arasındaki sistematik ofset giderilir:
$$\text{WSE}_{\text{düzeltilmiş}} = \text{WSE}_{\text{SWOT}} + \text{median}(\text{WSE}_{\text{AGİ}} - \text{WSE}_{\text{SWOT}})$$

### 3. Belirsizlik ve Ters Mesafe Ağırlıklı Düğüm (Node) Eşleştirmesi
İstasyon yakınındaki SWOT düğümleri istasyona olan ters mesafe ($d_i$) ve ölçüm varyansı ($\sigma_i^2 = \text{wse\_u}_i^2$) ile ağırlıklandırılarak yerel referans noktasına indirgenir:
$$w_i = \frac{1}{(d_i + \epsilon) \cdot (\sigma_i^2 + \epsilon)}, \quad \text{WSE}_{\text{istasyon}} = \frac{\sum w_i \cdot \text{WSE}_i}{\sum w_i}$$

### 4. Hibrit Akım Süreklileştirme (Makine Öğrenmesi Modülü)
- **Girdi Özellikleri ($X$):**
  - Gecikmeli yağış serileri ($P_{t}, P_{t-1}, P_{t-2}, P_{t-3}$)
  - Antecedent Precipitation Index ($API = \sum_{k=1}^7 0.85^k P_{t-k}$)
  - 2m Hava Sıcaklığı ($T_t$) ve Kar Erimesi Potansiyeli
  - En son ölçülen SWOT L4 debisi ve geçen gün sayısı ($\Delta t$)
  - Mevsimsel harmonikler ($\sin(2\pi \cdot \text{doy}/365), \cos(2\pi \cdot \text{doy}/365)$)
- **Hedef ($y$):** DSİ AGİ debisi / SWOT konsensüs debisi
- **Model:** Random Forest Regressor / Gradient Boosting Regressor

### 5. Sınıraşan Taşkın Dalgası Varış Süresi (Lead Time)
Hidrolik dalga hızı $c \approx 1.2 - 1.5\text{ m/s}$ üzerinden Bulgaristan barajlarından (örneğin Ivaylovgrad, $d = 42\text{ km}$) Edirne'ye varış süresi:
$$t_{\text{lead}} = \frac{d_{\text{km}} \times 1000}{c \times 3600} \approx 8.0 \text{ saat}$$

---

## 📂 Proje Dizin Yapısı

```
meric-swot-streamflow/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI REST API ve statik dosya sunucusu
│   ├── config.py                   # Sistem yolları ve hidrolojik sabitler
│   ├── models.py                   # Pydantic veri modelleri
│   └── services/
│       ├── __init__.py
│       ├── hydrocron.py            # NASA PO.DAAC Hydrocron API istemcisi & mock
│       ├── dsi_client.py           # DSİ Edirne 11. Bölge veri istemcisi
│       └── hydrology_engine.py     # QC, datum düzeltme, ML akım süreklileştirme
├── frontend/
│   ├── index.html                  # Modern responsive dashboard
│   └── static/
│       ├── css/
│       │   └── style.css           # Koyu tema ve nabız animasyonları
│       └── js/
│           └── app.js              # Leaflet harita, Plotly grafikler & REST API entegrasyonu
├── data/
│   ├── reaches_seed.json           # Meriç, Tunca, Arda SWORD reach segmentleri
│   ├── reaches_geojson.json        # Coğrafi eksen GeoJSON katmanı
│   ├── stations_seed.json          # DSİ AGİ istasyonları ve taşkın eşikleri
│   └── dams_seed.json              # Bulgaristan memba barajları (Ivaylovgrad vb.)
├── tests/
│   ├── test_hydrology.py           # Hidroloji motoru birim testleri
│   └── test_api.py                 # FastAPI REST uç nokta testleri
├── requirements.txt                # Bağımlılıklar
└── README.md                       # Kapsamlı sistem dokümantasyonu
```

---

## 🛠️ Kurulum ve Çalıştırma

### 1. Bağımlılıkların Kurulması
```bash
pip install -r requirements.txt
```

### 2. Uygulamanın Başlatılması
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
veya doğrudan:
```bash
python app/main.py
```

### 3. Web Arayüzüne Erişim
Tarayıcınızda açın:
👉 **http://localhost:8000**

---

## 🧪 Testlerin Çalıştırılması

Tüm hidroloji algoritmalarını ve REST uç noktalarını doğrulamak için:
```bash
python -m tests.test_hydrology
python -u tests/test_api.py
```

---

## 📊 REST API Uç Noktaları

| Metot | Uç Nokta | Açıklama |
|---|---|---|
| `GET` | `/` | İnteraktif Web Kullanıcı Arayüzü |
| `GET` | `/api/basin/overview` | Havza genel durumu, toplam Edirne debisi ve uyarılar |
| `GET` | `/api/reaches` | Tüm SWORD reach segmentleri ve son SWOT geçişleri |
| `GET` | `/api/reaches/{reach_id}` | Belirli reach'in detayları ve QC filtreleme özeti |
| `GET` | `/api/stations` | DSİ AGİ istasyonlarının anlık debi, kot ve eşik durumları |
| `GET` | `/api/hydrograph` | AGİ + SWOT + ML birleşik hidrografı ve hata metrikleri |
| `GET` | `/api/ridgeline` | Membadan mansaba boyuna sırt çizgisi profili |
| `GET` | `/api/alerts` | Sınıraşan erken uyarı ve lead-time hesaplamaları |
| `GET` | `/api/dams` | Bulgaristan memba baraj doluluk ve dolusavak durumları |
| `GET` | `/api/geojson/reaches` | Leaflet haritalama için GeoJSON FeatureCollection |
| `POST`| `/api/swot/qc-filter` | Dinamik SWOT kalite kontrol simülatörü |
