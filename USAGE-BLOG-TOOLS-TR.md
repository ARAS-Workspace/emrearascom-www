# Blog Araçları Kullanım Kılavuzu

For English: [USAGE-BLOG-TOOLS.md](USAGE-BLOG-TOOLS.md)

Blog, dosya tabanlı bir yapıya sahiptir. Her yazı, `src/pages/blog/posts/<slug>/`
dizininde kendi başına bulunur. Router yapısına müdahale edilmez: bir dizin
`posts/` altında yer alıyorsa yazı yayındadır, aksi halde yayında değildir.
`<slug>` değeri kebab-case biçiminde olmalıdır (örnek: `wireguard-notlari`).

## Komutlar

| Komut                       | İşlevi                                                                                |
|-----------------------------|---------------------------------------------------------------------------------------|
| `npm run new-post <slug>`   | Şablondan yeni bir yazı dizini oluşturur ve tarih bilgilerini işler.                  |
| `npm run touch-post <slug>` | Yazının güncellenme tarihini o ana ayarlar. Oluşturma tarihi değişmez.                |
| `npm run generate-llms`     | Yazıların `llms/*.txt` dosyalarını MDX kaynağından üretir. Bu dosyalar commit edilir. |
| `npm run gen-covers`        | OG kapak görsellerini üretir. Bu dosyalar build ürünüdür ve commit edilmez.           |

## Yeni Yazı Ekleme

```bash
npm run new-post wireguard-notlari
```

Komut, `src/pages/blog/posts/wireguard-notlari/` dizinini oluşturur. Dizin;
`meta.json`, `index.mdx` (Türkçe) ve `index.en.mdx` (İngilizce) dosyalarını
içerir. Sonrasında izlenecek adımlar:

1. `meta.json` dosyasını doldurun: `seo.tr` ve `seo.en` altında başlık ile açıklama, `tags` listesi, isteğe bağlı olarak `author` alanı. `author` boş bırakılırsa yazı site sahibine atfedilir.
2. `index.mdx` ve `index.en.mdx` gövdelerini yazın.
3. `npm run dev` komutuyla `https://localhost:5173/blog/wireguard-notlari` adresinden önizleyin.
4. `npm run generate-llms` komutunu çalıştırın.
5. Değişiklikleri commit edin. Push ve dağıtım süreçleri bunu takip eder.

Kapak görseli (OG görseli), prod derlemesi sırasında başlık ve açıklamadan
otomatik olarak üretilir. Elle bir işlem gerekmez.

## Yazı Güncelleme

İçeriği düzenledikten sonra güncellenme tarihini yenileyin:

```bash
npm run touch-post wireguard-notlari
```

Bu işlem yalnızca `meta.json` içindeki `updatedAt` alanını günceller. İçerik
değiştiyse `npm run generate-llms` komutunu çalıştırın ve değişiklikleri commit
edin.

## Yazı Silme ve Yayından Kaldırma

Yayından kaldırmak için (geri alınabilir), dizini `posts/` dışına taşıyın:

```bash
mv src/pages/blog/posts/wireguard-notlari /baska/dizin/
```

Kalıcı olarak silmek için:

```bash
rm -rf src/pages/blog/posts/wireguard-notlari
```

Her iki durumda da router yapısına dokunulmaz. Rota bilgisi diskten çözümlenir.
`llms/*.txt` dosyaları ilgili dizinle birlikte kaldırıldığından ayrı bir üretim
adımı gerekmez. Değişikliğin commit edilmesi yeterlidir.

## Notlar

- Tarihler, İstanbul saat dilimine göre `meta.json` içinde `GG/AA/YYYY SS:dd` biçiminde tutulur.
- Gövdede `#` (H1) kullanılmaz. Başlıklar `##` seviyesinden başlar. H1 değeri `seo.title` alanından üretilir.
- Yayın öncesi tam kontrol için `npm run prod` çalıştırılabilir. Bu komut derleme, prerender, llms ve kapak üretimini kapsar.
