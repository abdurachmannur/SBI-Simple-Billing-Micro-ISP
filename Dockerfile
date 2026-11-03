# Menggunakan Node.js 22 LTS terbaru berbasis Alpine Linux yang ringan & aman
FROM node:24-alpine

# Patch seluruh paket OS Alpine untuk menutup celah CVE terbaru + install git & tzdata
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache git tzdata

# Set zona waktu default (dapat diubah via docker-compose environment TZ)
ENV TZ=Asia/Jakarta
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Salin manifest dependensi terlebih dahulu untuk optimalisasi layer cache Docker
COPY package*.json ./

# Install seluruh dependensi secara bersih
RUN npm install --no-audit --no-fund

# Salin seluruh kode sumber aplikasi (termasuk version.json)
COPY . .

# Build frontend React + Vite ke dalam direktori /app/dist
RUN npm run build

# Pastikan direktori penyimpanan data persisten tersedia
RUN mkdir -p /app/data/uploads

# Ekspos port aplikasi
EXPOSE 3000

# Jalankan server Express + API MikroTik & Billing
CMD ["npx", "tsx", "server.ts"]
