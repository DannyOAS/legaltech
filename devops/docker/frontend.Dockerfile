FROM node:20-alpine
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend /app
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
