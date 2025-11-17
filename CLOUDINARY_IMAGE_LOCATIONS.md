# Cloudinary дээр зургийн байршил

## Cloudinary Dashboard руу хандах

**URL**: https://console.cloudinary.com/

## Зургууд хаана байрлах вэ?

### 1. **Media Library** дотор

1. Cloudinary Dashboard-руу нэвтэрнэ үү
2. Зүүн дээд буланд **"Media Library"** товчийг дарна
3. Дараах folder-уудад зургууд байрших болно:

```
📁 neoncanvas/
  ├── 📁 posts/          ← Бүх постын зургууд энд
  └── 📁 avatars/        ← Бүх хэрэглэгчийн avatar зургууд энд
```

### 2. **Шууд URL хандалт**

Та Media Library хэсэг рүү шууд орох боломжтой:
```
https://console.cloudinary.com/console/c-{CLOUD_NAME}/media_library/folders/home
```

Таны тохиолдолд:
```
https://console.cloudinary.com/console/c-dzuau3fae/media_library/folders/home
```

### 3. **Folder бүрийг харах**

- **Постын зургууд**: 
  ```
  https://console.cloudinary.com/console/c-dzuau3fae/media_library/folders/neoncanvas/posts
  ```

- **Avatar зургууд**:
  ```
  https://console.cloudinary.com/console/c-dzuau3fae/media_library/folders/neoncanvas/avatars
  ```

## Зургийн URL формат

Cloudinary дээр байршсан зургийн URL:

```
https://res.cloudinary.com/dzuau3fae/image/upload/v{VERSION}/{FOLDER}/{PUBLIC_ID}.{FORMAT}
```

**Жишээ**:
```
https://res.cloudinary.com/dzuau3fae/image/upload/v1731801234/neoncanvas/posts/abc123def456.png
```

## Зураг хайх

Media Library дотор:
1. Дээд хэсэгт **Search** box ашиглах
2. Folder-оор шүүх: `neoncanvas/posts` эсвэл `neoncanvas/avatars`
3. Огноогоор эрэмбэлэх (Latest first)

## Зураг устгах / засах

1. Media Library дотор зургийг олох
2. Зураг дээр дарж **Actions** цэс нээх:
   - ✏️ **Edit** - Өөрчлөх
   - 🗑️ **Delete** - Устгах
   - 🔗 **Copy URL** - URL-ийг хуулах
   - 🖼️ **Preview** - Томруулж харах

## Cloudinary Dashboard Statistics

Dashboard-ийн эхний хуудсанд харагдах мэдээлэл:
- 📊 **Storage used** - Ашигласан сангийн хэмжээ
- 📈 **Bandwidth** - Сарын дамжуулалт
- 🖼️ **Total images** - Нийт зургийн тоо
- 🎬 **Total videos** - Видео тоо (хэрэв байвал)

## Pro Tips

### Зургийг хурдан олох
```
Хайлт: folder:neoncanvas/posts
```

### Огнооны хооронд хайх
Dashboard > Media Library > Filter > Date range

### Зургийн URL-ээр хайх
Хэрэв таны database дээр secure_url хадгалагдсан бол:
1. URL-ээс **public_id** авах
2. Cloudinary Media Library-д хайх

