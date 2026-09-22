FROM node:24-alpine AS build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY client/ /app/client/
RUN npm run build
RUN cp -r /app/frontend/dist /app/dist
RUN mkdir -p /app/public && cp /app/client/public/landing.html /app/public/landing.html

FROM nginx:1.27-alpine AS runtime

RUN apk upgrade --no-cache

COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy React app to /app subdirectory
COPY --from=build /app/dist /usr/share/nginx/html/app

# Remove landing.html from app build (it shouldn't be in /app/)
RUN rm -f /usr/share/nginx/html/app/landing.html

# Copy landing page to dedicated landing root
COPY --from=build /app/public/landing.html /usr/share/nginx/html/landing/landing.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
