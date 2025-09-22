FROM node:18-alpine as dependencies
COPY package.json package-lock.json 
RUN npm ci --include=dev

FROM node:18-alpine as build

RUN npm install
COPY --from=dependencies /node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /build /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]