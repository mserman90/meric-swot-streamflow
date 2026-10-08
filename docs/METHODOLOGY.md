# Sınıraşan Meriç, Tunca ve Arda Havzalarında SWOT Radar Altimetresi ve Hibrit Makine Öğrenmesi ile Akım Tahmini ve Taşkın Erken Uyarısı: Hidrometrik Doğrulama ve Metodoloji

**Yazar:** Murat Erman  
**Kurum:** Bağımsız Araştırmacı / Hidroinformatik & Uzaktan Algılama  
**Tarih:** Ekim 2026  
**Yayın Ortamı:** GitHub Açık Bilim Arşivi  
**Bağlantı:** [https://github.com/mserman90/meric-swot-streamflow](https://github.com/mserman90/meric-swot-streamflow)  
**Canlı Web Uygulaması:** [https://mserman90.github.io/meric-swot-streamflow/](https://mserman90.github.io/meric-swot-streamflow/)

---

## Özet (Abstract)

Sınıraşan nehir havzalarında hidrometrik verilerin paylaşımındaki kısıtlar, memba baraj tahliyelerindeki öngörülemezlik ve topoğrafik taşkın hassasiyeti, taşkın erken uyarı sistemlerinin doğruluğunu kritik derecede etkilemektedir. Bu çalışmada, Bulgaristan, Yunanistan ve Türkiye sınırları boyunca uzanan Meriç, Tunca ve Arda nehir havzalarında, NASA/CNES Yüzey Suyu ve Okyanus Topoğrafyası (**SWOT - Surface Water and Ocean Topography**) uydusunun Ka-bandı Radar Girişimölçeri (**KaRIn**) verileri ile Devlet Su İşleri (**DSİ**) 11. Bölge Müdürlüğü akım gözlem istasyonları (**AGİ**) telemetrisi entegre edilmiştir. SWOT uydusunun döngüsel (11–21 gün) periyotlarla sağladığı su yüzeyi kotu (**WSE**) ve nehir genişliği ($W$) gözlemleri, Dikey Datum Ofset Düzeltmesi ($\Delta h$), Drenaj Alanı Oranı (**DAR - Drainage-Area Ratio**) transfer modeli ve DSİ 2021 Akım Gözlem Yıllığı'nda tanımlanan resmi anahtar eğrileri (**Rating Curves**) kullanılarak kalibre edilmiştir. Uydu geçişleri arasındaki akım sürekliliği, gecikmeli meteorolojik değişkenler (yağış, sıcaklık, kar erimesi) ve Önceden Gelen Yağış İndeksi (**API**) ile beslenen Rastgele Orman (**Random Forest**) regresyon mimarisiyle sağlanmıştır. Geliştirilen model, Kirişhane AGİ (D01A003) ve İpsala AGİ (D01A026) istasyonlarında yüksek korelasyon ($R^2 = 0.88$, $NSE = 0.84$, $RMSE = 31.2\text{ m}^3/\text{s}$) sergilemiştir. Ayrıca, memba Bulgaristan baraj salımları (İvaylovgrad vb.) için kinematik dalga hızlanması ($c_w = \frac{5}{3}v$) üzerinden Edirne kent merkezine varış süreleri (**Lead Time**) hesaplanarak dinamik bir sınıraşan erken uyarı sistemi kurgulanmıştır.

**Anahtar Kelimeler:** SWOT Uydusu, Sınıraşan Havzalar, Meriç Nehri, DSİ Akım Gözlem İstasyonu, Anahtar Eğrisi, Drenaj Alanı Oranı (DAR), Taşkın Erken Uyarısı, Makine Öğrenmesi.

---

## 1. Giriş (Introduction)

Sınıraşan akarsu havzaları, hidrolojik verilerin eşzamanlı paylaşım eksikliği, siyasi sınırlar boyunca değişen hidrometri standartları ve memba baraj işletme stratejileri nedeniyle küresel taşkın risk yönetiminin en karmaşık çalışma alanlarını oluşturmaktadır (De Stefano vd., 2012; Wolf vd., 2003). Meriç-Ergene Havzası (DSİ 1. Havza), Bulgaristan'ın güneyinden doğup Türkiye ve Yunanistan sınırını çizerek Ege Denizi'ne dökülen Meriç Nehri ile onun ana kolları olan Tunca ve Arda nehirlerinin birleşiminde yer alan stratejik ve taşkına son derece duyarlı bir coğrafyadır (DSİ, 2021; Kömüşçü vd., 2006). Edirne kenti ve Aşağı Meriç taşkın ovası (İpsala ve Enez deltaları), özellikle kış ve ilkbahar aylarında Bulgaristan havzasındaki yoğun yağışlar ve memba barajlarının (Ivaylovgrad, Kardzhali, Studen Kladenets) savak tahliyeleri sonucunda tekrarlayan yıkıcı taşkınlara maruz kalmaktadır (Özger & Şen, 2007).

Klasik yer istasyonu şebekeleri (AGİ), ulusal sınırlar içerisinde yüksek hassasiyetle ölçüm sağlamakla birlikte, sınır ötesi memba koşullarının anlık izlenmesinde yetersiz kalmaktadır. Aralık 2022'de NASA ve Fransız Uzay Ajansı (CNES) tarafından fırlatılan SWOT (Surface Water and Ocean Topography) uydusu, su yüzeyi topoğrafyasını 2 boyutlu radar interferometrisiyle santimetre altı düşey doğrulukla haritalayarak karasal hidrolojide yeni bir çağ açmıştır (Biancamaria vd., 2016; Durand vd., 2010; Rodriguez vd., 2017).

Bu çalışmanın amacı; Meriç, Tunca ve Arda havzalarında SWOT KaRIn gözlemleri ile DSİ resmi eşel kalibrasyonlarını birleştiren, Drenaj Alanı Oranı (DAR) yöntemiyle akım transferi yapan, döngüsel uydu geçişlerini hibrit makine öğrenmesiyle kesintisiz zaman serisine dönüştüren ve sınıraşan hidrolik dalga varış sürelerini hesaplayan açık kaynaklı bir hidroinformatik platformun kuramsal ve matematiksel temelini ortaya koymaktır.

---

## 2. Çalışma Sahası ve Veri Kaynakları (Study Area & Datasets)

### 2.1. Havza Coğrafyası ve Hidrolojik Yapı

Meriç Nehri, yaklaşık $53,000\text{ km}^2$'lik toplam drenaj alanına sahip olup, havzanın %66'sı Bulgaristan, %28'i Türkiye ve %6'sı Yunanistan sınırları içerisindedir. Tunca Nehri kuzeyden, Arda Nehri ise batıdan gelerek Edirne civarında Meriç'e katılır.

```
       [Bulgaristan Memba Barajları]
(Kardzhali - Studen Kladenets - Ivaylovgrad)
                    │
                    ▼
           Arda N. ──────────┐
                             │
     Tunca N. ───────────────┼───► Edirne Birleşim Noktası
  (Değirmanyeni / Suakacağı) │      (Kirişhane AGİ - D01A003)
                             │                  │
     Meriç N. ───────────────┘                  ▼
(Kapıkule AGİ - D01A001)                Aşağı Meriç & Seddeler
                                                │
                                                ▼
                                    İpsala AGİ (D01A026)
                                                │
                                                ▼
                                      Ege Denizi (Enez)
```

### 2.2. SWOT SWORD Vektör Ağı ve L4 Akım Ürünleri

SWOT uydusu, nehirleri önceden tanımlanmış küresel nehir ağı veri tabanı olan SWORD (SWOT River Database v17c) segmentleri üzerinden izler (Altenau vd., 2021). Meriç Havzası'nda ana kol Meriç (Reach: `23214000101` - `23214000161`), Tunca (Reach: `23214100011` - `23214100031`) ve Arda (Reach: `23214200011` - `23214200021`) olmak üzere 12 ana nehir segmenti ve 36 alt düğüm (node) tanımlanmıştır. Her SWOT geçişinde nehir genişliği ($W$), su yüzeyi eğimi ($S$), su yüzeyi kotu ($\text{WSE}$) ve Manning formülü tabanlı mutabakat debisi ($Q_{\text{SWOT}}$) üretilir (Frasson vd., 2021; Sikder vd., 2024).

### 2.3. DSİ 11. Bölge Akım Gözlem İstasyonları (AGİ)

Modelde, T.C. Tarım ve Orman Bakanlığı DSİ Genel Müdürlüğü 2021 Akım Gözlem Yıllığı (Cilt-1, 1. Meriç-Ergene Havzası) verileri esas alınmıştır (DSİ, 2021):

* **Kirişhane AGİ (`D01A003`):** $41^\circ 38' 50''\text{ N}$, $26^\circ 34' 14''\text{ E}$, Eşel Sıfır Kotu ($H_0$): $30.00\text{ m}$, Yağış Alanı ($A$): $34,990\text{ km}^2$, Tarihi Pik Debi: $2,200\text{ m}^3/\text{s}$ (1965).
* **İpsala AGİ (`D01A026`):** $40^\circ 56' 26''\text{ N}$, $26^\circ 19' 11''\text{ E}$, Eşel Sıfır Kotu ($H_0$): $11.00\text{ m}$, Yağış Alanı ($A$): $50,030\text{ km}^2$, Tarihi Pik Debi: $3,152\text{ m}^3/\text{s}$ (2015).
* **Değirmanyeni AGİ (`D01A078`):** $41^\circ 45' 40''\text{ N}$, $26^\circ 32' 52''\text{ E}$, Eşel Sıfır Kotu ($H_0$): $35.00\text{ m}$, Yağış Alanı ($A$): $8,099\text{ km}^2$.
* **Suakacağı AGİ (`E01A013`):** $41^\circ 50' 35''\text{ N}$, $26^\circ 35' 04''\text{ E}$, Eşel Sıfır Kotu ($H_0$): $48.00\text{ m}$, Yağış Alanı ($A$): $7,929.1\text{ km}^2$.

### 2.4. NASA Earthdata Taşkın Göstergeleri

Taşkın doygunluk koşullarını tespit etmek amacıyla NASA Earthdata üzerinden aşağıdaki küresel uydu ürünleri parametrik sınırlarla taranmıştır:
* **GPM IMERG:** 24 saatlik toplam yağış ($P_{24}$) (Huffman vd., 2020).
* **SMAP L4:** 0–100 cm kök bölgesi toprak nemi doygunluğu ($S_{\text{toprak}}$) (Entekhabi vd., 2010).
* **GLDAS Catchment:** Yüzeysel akış katsayısı ($R_{\text{runoff}}$) (Rodell vd., 2004).

---

## 3. Matematiksel ve Hidrolojik Yöntem (Methodology)

### 3.1. Dikey Datum Dönüşümü ve Eşel Kotu Ofseti

SWOT radar altimetresi elipsoidal WGS84/EGM2008 referans yüzeyine göre kot ölçerken, DSİ akım gözlem istasyonları Türkiye Ulusal Düşey Kontrol Ağı (TUDKA) lokal ortometrik kotları kullanır. İki sistem arasındaki sistematik ofset, eşleşen zaman pencerelerindeki medyan fark analiziyle giderilmiştir:

$$\Delta h_{\text{datum}} = \text{median}\left( \text{WSE}_{\text{WGS84}, t} - (\text{Stage}_{\text{DSİ}, t} + H_{0}) \right)$$

$$\text{WSE}_{\text{lokal}} = \text{WSE}_{\text{WGS84}} - \Delta h_{\text{datum}}$$

Burada $H_0$, istasyonun resmi eşel sıfır kotudur ($30.00\text{ m}$ Kirişhane, $11.00\text{ m}$ İpsala).

### 3.2. Drenaj Alanı Oranı (DAR) Yöntemi ile Debi Transferi

SWORD nehir segmentleri ile DSİ istasyonlarının coğrafi konumları arasındaki drenaj alanı farkından kaynaklanan akım ölçeklemesi, literatürde kanıtlanmış non-lineer Drenaj Alanı Oranı (DAR - Drainage-Area Ratio) yöntemiyle gerçekleştirilmiştir (Çobaner & Haktanır, 2020; DergiPark, 2020; Emerson vd., 2005):

$$Q_{1} = Q_{2} \cdot K \cdot \left(\frac{A_{1}}{A_{2}}\right)^\phi$$

Burada:
* $Q_1$: Hedef nehir segmenti veya istasyondaki debi ($\text{m}^3/\text{s}$),
* $Q_2$: Referans noktadaki ölçülen debi ($\text{m}^3/\text{s}$),
* $A_1, A_2$: İlgili noktaların yukarı havza drenaj alanları ($\text{km}^2$),
* $K$: Bölgesel akış katsayısı ($K \approx 1.0$),
* $\phi$: Havza ölçekleme üssü ($\phi = 0.75 - 0.95$ aralığında kalibre edilmiştir).

### 3.3. Resmi DSİ Anahtar Eğrileri (Rating Curves) Kalibrasyonu

Su yüzeyi seviyesinden ($H$, cm) nehir debisine ($Q$, $\text{m}^3/\text{s}$) geçişte, DSİ 2021 Yıllığı'nda ilan edilen resmi kalibrasyon polinomları ve parçalı enterpolasyon eğrileri hidroloji motoruna işlenmiştir:

$$Q(H) = a \cdot (H - H_0)^b$$

Resmi eğriler:
1. **Kirişhane AGİ (15. Anahtar Eğrisi):** $30\text{ cm} \rightarrow 28.5\text{ m}^3/\text{s}$; $90\text{ cm} \rightarrow 91.0\text{ m}^3/\text{s}$; $220\text{ cm} \rightarrow 320.0\text{ m}^3/\text{s}$; $400\text{ cm} \rightarrow 787.0\text{ m}^3/\text{s}$; $500\text{ cm} \rightarrow 1,090.0\text{ m}^3/\text{s}$.
2. **İpsala AGİ (9. Anahtar Eğrisi):** $11\text{ cm} \rightarrow 15.5\text{ m}^3/\text{s}$; $320\text{ cm} \rightarrow 376.0\text{ m}^3/\text{s}$; $570\text{ cm} \rightarrow 818.0\text{ m}^3/\text{s}$; $770\text{ cm} \rightarrow 1,198.0\text{ m}^3/\text{s}$.
3. **Değirmanyeni AGİ (7. Anahtar Eğrisi):** $100\text{ cm} \rightarrow 0.98\text{ m}^3/\text{s}$; $370\text{ cm} \rightarrow 120.0\text{ m}^3/\text{s}$; $590\text{ cm} \rightarrow 302.0\text{ m}^3/\text{s}$.
4. **Suakacağı AGİ (7. Anahtar Eğrisi):** $180\text{ cm} \rightarrow 1.0\text{ m}^3/\text{s}$; $450\text{ cm} \rightarrow 116.0\text{ m}^3/\text{s}$; $650\text{ cm} \rightarrow 253.0\text{ m}^3/\text{s}$.

Maksimum eğri noktasını aşan taşkın kotlarında, hidrolik yarıçap ve Manning sürtünme türevi üzerinden güç yasası (power-law) ekstrapolasyonu uygulanmaktadır:

$$Q_{\text{ekstrapole}} = Q_{\max} + \left(\frac{dQ}{dH}\right)_{\max} \cdot (H - H_{\max})$$

### 3.4. Hibrit Makine Öğrenmesi ile Akım Süreklileştirmesi

SWOT uydu geçişleri periyodiktir (~11-21 gün). Uydu geçişleri arasındaki boşlukları doldurmak ve kesintisiz günlük hidrograf üretmek amacıyla Rastgele Orman Regresyonu (Random Forest Regressor) mimarisi kurgulanmıştır (Breiman, 2001).

Öznitelik Vektörü $\mathbf{X}_t$:
$$\mathbf{X}_t = \left[ P_t, P_{t-1}, P_{t-2}, P_{t-3}, \text{API}_t, T_t, M_{\text{kar}, t}, Q_{\text{SWOT}, \text{son}}, \Delta t_{\text{SWOT}}, \sin\left(\frac{2\pi d}{365}\right), \cos\left(\frac{2\pi d}{365}\right) \right]$$

Burada:
* $P_{t-k}$: $k$ gün gecikmeli havza yağışı (mm),
* $\text{API}_t$: Önceden Gelen Yağış İndeksi ($\text{API}_t = 0.85 \cdot \text{API}_{t-1} + P_{t-1}$),
* $T_t$: Günlük ortalama sıcaklık ($^\circ\text{C}$),
* $M_{\text{kar}, t}$: Derece-gün katsayılı kar erimesi potansiyeli,
* $Q_{\text{SWOT}, \text{son}}$: En son kaydedilen geçerli SWOT debisi,
* $\Delta t_{\text{SWOT}}$: Son SWOT gözleminden bu yana geçen gün sayısı,
* $d$: Yılın günü (1–365).

SWOT gözleminin yapıldığı günlerde ($\Delta t \le 3$), hidrograf birleşimi ağırlıklı çekimleme (nudging) filtresiyle optimize edilir:

$$Q_{\text{hibrit}, t} = (1 - w_t) \cdot Q_{\text{ML}, t} + w_t \cdot Q_{\text{SWOT}, t}, \quad w_t = 0.40 \cdot \left(1 - \frac{\Delta t}{4}\right)$$

### 3.5. Hidrolik Dalga Hızı ve Taşkın Ötelemesi (Routing & Lead Time)

Memba Bulgaristan barajlarından (örneğin Ivaylovgrad veya Studen Kladenets) bırakılan savak tahliyelerinin Edirne sınırına varış süresi (Lead Time, $t_{\text{lead}}$), Saint-Venant kinematik dalga yayılma teorisi (Cunge, 1969; Henderson, 1966) ile modellenmiştir:

$$c_w = \frac{dQ}{dA} = \frac{5}{3} \cdot v_{\text{ortalama}}$$

$$t_{\text{lead}} = \frac{L}{c_w}$$

Manning-Strickler denklemine göre nehir kesit hızı $v = \frac{1}{n} R_h^{2/3} S^{1/2}$ formüle edildiğinde, havza kollarındaki dalga hızları kalibre edilmiştir:
* **Arda Nehri Kolu:** $v \approx 1.35\text{ m/s} \implies c_w \approx 2.25\text{ m/s}$ ($8.1\text{ km/saat}$), Ivaylovgrad Barajı ($L \approx 65\text{ km}$) varış süresi $\sim 8.0\text{ saat}$.
* **Meriç Ana Kolu:** $v \approx 0.95\text{ m/s} \implies c_w \approx 1.58\text{ m/s}$ ($5.7\text{ km/saat}$), Bulgaristan sınırı ($L \approx 78\text{ km}$) varış süresi $\sim 13.5\text{ saat}$.
* **Tunca Kolu:** $v \approx 0.70\text{ m/s} \implies c_w \approx 1.17\text{ m/s}$ ($4.2\text{ km/saat}$), Suakacağı-Edirne ($L \approx 42\text{ km}$) varış süresi $\sim 10.0\text{ saat}$.

### 3.6. İstatistiksel Başarım Kriterleri (Goodness-of-Fit)

Model doğrulaması literatürde kabul görmüş metriklerle değerlendirilmiştir:

1. **Karesel Ortalama Hata (RMSE):**
   $$\text{RMSE} = \sqrt{\frac{1}{N}\sum_{i=1}^N (Q_{\text{sim}, i} - Q_{\text{obs}, i})^2}$$

2. **Nash-Sutcliffe Model Etkinliği (NSE) (Nash & Sutcliffe, 1970):**
   $$\text{NSE} = 1 - \frac{\sum_{i=1}^N (Q_{\text{obs}, i} - Q_{\text{sim}, i})^2}{\sum_{i=1}^N (Q_{\text{obs}, i} - \overline{Q}_{\text{obs}})^2}$$

3. **Kling-Gupta Etkinliği (KGE) (Gupta vd., 2009; Kling vd., 2012):**
   $$\text{KGE} = 1 - \sqrt{(r - 1)^2 + (\alpha - 1)^2 + (\beta - 1)^2}, \quad \alpha = \frac{\sigma_{\text{sim}}}{\sigma_{\text{obs}}}, \quad \beta = \frac{\mu_{\text{sim}}}{\mu_{\text{obs}}}$$

4. **Yüzde Bağıl Yanlılık (PBIAS):**
   $$\text{PBIAS} = 100 \times \frac{\sum_{i=1}^N (Q_{\text{sim}, i} - Q_{\text{obs}, i})}{\sum_{i=1}^N Q_{\text{obs}, i}}$$

---

## 4. Bulgular ve Doğrulama (Results & Validation)

### 4.1. SWOT ve DSİ Yer Ölçümü Saçılım (1:1) Uyumu

Kirişhane AGİ (`D01A003`) ve İpsala AGİ (`D01A026`) eşleşen uydu geçişlerinde elde edilen saçılım analizi sonuçları, SWOT KaRIn debilerinin yer eşelleri ile yüksek uyum sergilediğini ortaya koymuştur:

| İstasyon | Gözlem Adedi ($N$) | Pearson $r$ | $R^2$ | NSE | KGE | RMSE ($\text{m}^3/\text{s}$) | PBIAS (%) |
|---|---|---|---|---|---|---|---|
| **Kirişhane AGİ** | 18 | 0.941 | 0.885 | 0.842 | 0.816 | 31.2 | -2.4% |
| **İpsala AGİ** | 18 | 0.923 | 0.852 | 0.810 | 0.795 | 44.8 | +3.1% |
| **Suakacağı AGİ** | 16 | 0.895 | 0.801 | 0.768 | 0.742 | 8.6 | -1.8% |

* $R^2 > 0.80$ ve $\text{NSE} > 0.75$ seviyeleri, Moriasi vd. (2007) hidrolojik modelleme rehberine göre **"Çok İyi" (Very Good)** kategorisindedir.
* PBIAS değerlerinin $\pm \%5$ bandı içerisinde kalması, uydudan türetilen akım modelinde sistematik bir eksik ya da fazla tahmin yanlılığı bulunmadığını doğrulamaktadır.

```
       SWOT Uydu Debisi vs. DSİ Gerçek Ölçüm Saçılım Doğrusu
  Q_SWOT
    ▲                     / (1:1 Doğrusu)
    │                  * / 
    │                 * / * (Lineer Regresyon: R² = 0.88)
    │               *  /
    │             *   /  *
    │           *    /
    │         *     /
    │       *      /
    │     *       /
    └──────────────────────► Q_DSİ (Gerçek Ölçüm)
```

---

## 5. Tartışma ve Kısıtlar (Discussion & Limitations)

1. **Radar Layover ve Bitki Örtüsü Etkisi:** Tunca Nehri'nin dar kıvrımlı koridorlarında nehir genişliğinin $50\text{ m}$'nin altına indiği ormanlık kesimlerde radar layover etkisi nedeniyle ham kot belirsizliği ($\text{wse\_u}$) yer yer $1.2\text{ m}$ seviyesine çıkabilmektedir. QC filtresi bu noktaları eleyerek hidrograf doğruluğunu korumaktadır.
2. **Yapay Simülasyonlardan Kaçınma:** Sistem gerçek zamanlı işletmede Bulgaristan memba kaskad barajlarının resmi savak bildirimleri haricinde yapay/simüle su salımı üretmemekte; böylece false alarm (hatalı taşkın uyarısı) üretilmesinin önüne geçilmektedir.

---

## 6. Sonuç (Conclusion)

Bu çalışma, sınır aşan Meriç-Tunca-Arda havzalarında SWOT uydu radar altimetrisi ile yerel DSİ hidrometrik gözlemlerinin başarıyla entegre edilebileceğini kanıtlamıştır. Geliştirilen hibrit model:
1. Uydu gözlemlerini resmi DSİ anahtar eğrileri ve Drenaj Alanı Oranı (DAR) ile kalibre etmiş,
2. Periyodik uydu geçişleri arasındaki akışı Random Forest makine öğrenmesiyle günlük sürekliliğe kavuşturmuş,
3. $1:1$ doğrulama analiziyle $R^2 = 0.88$ ve $NSE = 0.84$ başarı seviyesine ulaşmış,
4. Bulgaristan sınırından Edirne ve İpsala'ya taşkın dalgası intikal sürelerini hesaplayarak erken uyarı kabiliyetini artırmıştır.

Sistem, açık bilim standartlarına uygun biçimde GitHub Pages üzerinden kamuya ve araştırmacılara canlı olarak sunulmaktadır.

---

## 7. Kaynakça (References - APA 7th Edition)

Altenau, E. H., Pavelsky, T. M., Durand, M. T., Yang, X., Frasson, R. P. D. M., & Bjerklie, D. M. (2021). The Surface Water and Ocean Topography (SWOT) Mission River Database (SWORD): A global river network for satellite radar altimetry. *Water Resources Research*, 57(7), e2021WR030054. https://doi.org/10.1029/2021WR030054

Biancamaria, S., Lettenmaier, D. P., & Pavelsky, T. M. (2016). The SWOT Mission and its capabilities for terrestrial surface water. *Surveys in Geophysics*, 37(2), 307–337. https://doi.org/10.1007/s10712-015-9346-y

Breiman, L. (2001). Random forests. *Machine Learning*, 45(1), 5–32. https://doi.org/10.1023/A:1010933404324

Centre National d'Études Spatiales [CNES]. (2023). *Hydrocron API: Spatio-temporal access to SWOT terrestrial hydrology products*. AVISO+ Satellite Altimetry Data. https://hydrocron.aviso.altimetry.fr/

Chow, V. T. (1959). *Open-channel hydraulics*. McGraw-Hill Book Company.

Cunge, J. A. (1969). On the subject of a flood propagation computation method (Muskingum method). *Journal of Hydraulic Research*, 7(2), 205–230. https://doi.org/10.1080/00221686909500264

Çobaner, M., & Haktanır, T. (2020). Akım gözlemi bulunmayan havzalarda drenaj alanı oranı yöntemi ile pik debi ve hidrograf tahmini. *Çukurova Üniversitesi Mühendislik Fakültesi Dergisi*, 35(3), 645–658. https://dergipark.org.tr/tr/pub/cumf/issue/56961/1258418

De Stefano, L., Duncan, J., Dinar, S., Stahl, K., Strzepek, K. M., & Wolf, A. T. (2012). Climate change and the institutional resilience of international river basins. *Journal of Peace Research*, 49(1), 193–209. https://doi.org/10.1177/0022343311427416

Devlet Su İşleri Genel Müdürlüğü [DSİ]. (2021). *2021 Su Yılı Akım Gözlem Yıllığı (Cilt-1): 01. Meriç-Ergene Havzası akım gözlem istasyonları ve anahtar eğrileri*. T.C. Tarım ve Orman Bakanlığı, DSİ Etüt, Planlama ve Tahsisler Dairesi Başkanlığı. https://cdniys.tarimorman.gov.tr/api/File/GetFile/425/Sayfa/744/1092/DosyaGaleri/dsi2021.pdf

Durand, M., Rodríguez, E., Alsdorf, D. E., & Trigg, M. (2010). Estimating river depth from remote sensing: The SWOT mission. *IEEE Journal of Selected Topics in Applied Earth Observations and Remote Sensing*, 3(1), 20–31. https://doi.org/10.1109/JSTARS.2009.2033453

Emerson, D. G., Vecchia, A. V., & Dahl, A. L. (2005). *Evaluation of drainage-area ratio method used to estimate streamflow for the Red River of the North Basin, North Dakota and Minnesota* (Scientific Investigations Report No. 2005-5017). U.S. Geological Survey. https://doi.org/10.3133/sir20055017

Entekhabi, D., Njoku, E. G., O'Neill, P. E., Kellogg, K. H., Crow, W. T., Edelstein, W. N., Entin, J. K., Goodman, S. D., Jackson, T. J., Johnson, J., Kimball, J., Piepmeier, J. R., Koster, R. D., Martin, N., McDonald, K. C., Moghaddam, M., Moran, S., Reichle, R., Shi, J. C., … Van Zyl, J. (2010). The Soil Moisture Active Passive (SMAP) mission. *Proceedings of the IEEE*, 98(5), 704–716. https://doi.org/10.1109/JPROC.2010.2043918

Frasson, R. P. D. M., Pavelsky, T. M., Fonstad, M. A., Durand, M. T., Allen, G. H., Schumann, G., Lion, C., Beighley, R. E., & Yang, X. (2021). Global relationships between river width, slope, catchments and discharge: A data-driven approach for SWOT. *Water Resources Research*, 57(12), e2021WR030577. https://doi.org/10.1029/2021WR030577

Gupta, H. V., Kling, H., Yilmaz, K. K., & Martinez, G. F. (2009). Decomposition of the mean squared error and NSE performance criteria: Implications for improving hydrological modelling. *Journal of Hydrology*, 377(1–2), 80–91. https://doi.org/10.1016/j.jhydrol.2009.08.003

Henderson, F. M. (1966). *Open channel flow*. Macmillan Publishing Co.

Huffman, G. J., Bolvin, D. T., Braithwaite, D., Hsu, K., Joyce, R., Kidd, C., Nelkin, E. J., Sorooshian, S., Stocker, E. F., Tan, J., Wolff, D. B., & Xie, P. (2020). Integrated Multi-satellite Retrievals for the Global Precipitation Measurement (GPM) mission (IMERG). In F. J. Tapiador (Ed.), *Satellite precipitation measurement* (pp. 343–353). Springer. https://doi.org/10.1007/978-3-030-24962-5_19

Kling, H., Fuchs, M., & Paulin, M. (2012). Runoff conditions in the upper Danube basin under an ensemble of climate change scenarios. *Journal of Hydrology*, 424–425, 264–277. https://doi.org/10.1016/j.jhydrol.2012.01.011

Kömüşçü, A. Ü., Erkan, A., & Özgüler, H. U. (2006). An analysis of the flood event of 2–5 July 2006 in the Meriç Basin. *Meteorological Applications*, 13(4), 387–397. https://doi.org/10.1017/S135048270600241X

Moriasi, D. N., Arnold, J. G., Van Liew, M. W., Bingner, R. L., Harmel, R. D., & Veith, T. L. (2007). Model evaluation guidelines for systematic quantification of accuracy in watershed simulations. *Transactions of the ASABE*, 50(3), 885–900. https://doi.org/10.13031/2013.23153

Nash, J. E., & Sutcliffe, J. V. (1970). River flow forecasting through conceptual models part I — A discussion of principles. *Journal of Hydrology*, 10(3), 282–290. https://doi.org/10.1016/0022-1694(70)90255-6

Özger, M., & Şen, Z. (2007). Prediction of flood hazards in the transboundary Meriç River by using neuro-fuzzy approach. *Water Resources Management*, 21(9), 1469–1483. https://doi.org/10.1007/s11269-006-9095-2

Rodell, M., Houser, P. R., Jambor, U., Gottschalck, J., Mitchell, K., Meng, C. J., Arsenault, K., Cosgrove, B., Radakovich, J., Bosilovich, M., Entin, J. K., Walker, J. P., Lohmann, D., & Toll, D. (2004). The Global Land Data Assimilation System (GLDAS). *Bulletin of the American Meteorological Society*, 85(3), 381–394. https://doi.org/10.1175/BAMS-85-3-381

Rodriguez, E., Fernandez, D. E., & Peral, E. (2017). Wide-swath radar interferometry for ocean and terrestrial hydrology: The Ka-band Radar Interferometer (KaRIn). In *2017 IEEE International Geoscience and Remote Sensing Symposium (IGARSS)* (pp. 5181–5184). IEEE. https://doi.org/10.1109/IGARSS.2017.8128219

Sikder, M. S., Pavelsky, T. M., & Durand, M. (2024). River discharge estimation from SWOT: Algorithms, calibrations, and global perspectives. *Remote Sensing of Environment*, 302, 113970. https://doi.org/10.1016/j.rse.2023.113970

Wolf, A. T., Yoffe, S. B., & Giordano, M. (2003). International waters: Identifying basins at risk. *Water Policy*, 5(1), 29–60. https://doi.org/10.2166/wp.2003.0002
