FROM node:18-alpine as dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# Установите ВСЕ зависимости включая devDependencies
RUN npm ci --include=dev

FROM node:18-alpine as build
WORKDIR /app
RUN npm install
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]