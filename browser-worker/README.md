# Atlas Browser Worker — Tarayıcı İşçisi

Atlas'ın web üzerinde kontrollü olarak gezinmesini sağlayan Playwright servisidir.

## Ne yapar?

- İzin verilen alan adlarına gider.
- Ürün araması yapabilir.
- Sayfa metnini ve fiyat adaylarını çıkarabilir.
- `goto`, `search`, `click`, `fill`, `press`, `extract`, `screenshot` aksiyonlarını çalıştırabilir.
- Giriş, ödeme, mesaj, hesap değişikliği ve satın alma gibi yüksek etkili işlemleri varsayılan olarak onay kapısında tutar.
- Canlı satın alma ayrıca `ATLAS_ALLOW_LIVE_PURCHASE=true` gerektirir.

Playwright'ın tarayıcı ikili dosyalarını ayrıca kurmak gerekir; resmi dokümantasyon da `playwright install` adımını belirtir.

## Docker ile çalıştırma

```bash
docker build -t atlas-browser-worker ./browser-worker

docker run --rm -p 8787:8787 \
  -e ATLAS_BROWSER_WORKER_TOKEN=BURAYA_GUCLU_BIR_TOKEN \
  -e ATLAS_DEFAULT_ALLOWED_DOMAINS=trendyol.com,hepsiburada.com,n11.com,amazon.com.tr,pazarama.com \
  atlas-browser-worker
```

Sağlık kontrolü:

```bash
curl http://localhost:8787/health
```

## Atlas API bağlantısı

API sunucusunda:

```text
ATLAS_BROWSER_WORKER_URL=http://<worker-host>:8787/run
ATLAS_BROWSER_WORKER_TOKEN=<aynı-token>
```

Worker internete açık olacaksa doğrudan açık port yerine güvenli bir tünel veya özel ağ kullanılması önerilir.

## Güvenlik

Worker yalnızca Atlas'ın gönderdiği `allowedDomains` listesindeki alan adlarında çalışır. Ödeme/satın alma gibi işlemler için ayrıca kullanıcı onayı gerekir.
