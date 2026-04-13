# PulseCompress

PulseCompress est une application Next.js qui permet de compresser localement des images et des videos depuis une interface moderne.

## Points clés

- Compression d'images avec `sharp`
- Compression de videos avec `ffmpeg`
- Interface moderne avec apercu, drag-and-drop et telechargement direct
- Aucun service externe ni cle API necessaire

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Sharp
- FFmpeg via `ffmpeg-static`

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir [http://localhost:3000](http://localhost:3000).

## Build production

```bash
npm run build
npm start
```

## Notes

- Les fichiers medias sont traites localement par le serveur Next.js.
- Le projet ne depend d'aucune variable d'environnement pour fonctionner.
