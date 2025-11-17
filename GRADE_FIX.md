# Grade Filter Fix Guide

## Асуудал
Leaderboard дээр "10 анги" сонгоход хэрэглэгч харагдахгүй байна.

## Шалтгаан
1. Supabase дээр `users` хүснэгтэд `grade` багана нэмэгдээгүй байж магадгүй
2. Хуучин хэрэглэгчид `grade` утгагүй байна

## Шийдэл

### 1. Supabase Migration ажиллуулах

Supabase Dashboard-руу орж SQL Editor дээр дараах SQL-ыг ажиллуулна уу:

```sql
-- Add grade column to users table
alter table if exists users 
add column if not exists grade text;

-- Add comment
comment on column users.grade is 'Student grade/class: 10, 11, 12, or R (graduating class)';
```

### 2. Хуучин хэрэглэгчдийн grade тохируулах (optional)

Хэрэв хуучин хэрэглэгчдэд grade өгөхийг хүсвэл:

```sql
-- Жишээ: Бүх студентүүдэд 10 анги өгөх
update users 
set grade = '10' 
where role = 'student' and grade is null;
```

### 3. Шинэ хэрэглэгч үүсгэх тестлэх

1. Logout хийнэ
2. Шинэ хэрэглэгчээр Sign Up хийнэ (grade сонгоно)
3. Profile хуудас руу орж grade харагдаж байгаа эсэхийг шалгана
4. Leaderboard дээр "10 анги" filter сонгоход харагдаж байгаа эсэхийг шалгана

### 4. Production дээр шалгах

Өнөөдөр push хийсэн код Vercel дээр автоматаар deploy хийгдсэн байх ёстой.

```bash
# Local дээр тестлэх бол:
npm run dev
```

## Шалгах алхамууд

1. ✅ Migration ажилласан эсэх: Supabase SQL Editor дээр `select * from users limit 5;` гэж шалгаад `grade` багана харагдаж байгаа эсэхийг үзнэ
2. ✅ Profile дээр grade харагдаж байгаа эсэх
3. ✅ Profile засах үед grade солих боломжтой эсэх
4. ✅ Leaderboard API `grade` буцааж байгаа эсэх: `/api/leaderboard` рүү очиход `grade` field харагдах ёстой
5. ✅ Leaderboard filter ажиллаж байгаа эсэх

## Хурдан шалгах команд

```bash
# Vercel deployment шалгах
# Browser дээр: mind-verse-six.vercel.app/api/leaderboard
# Response дээр grade field харагдах ёстой

# Local build
npm run build
```
