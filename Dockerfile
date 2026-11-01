# FloodOps: satu server Node melayani API dan antarmuka hasil build.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 FLOODOPS_DATA_DIR=/data
VOLUME /data
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 4000
CMD ["node", "server/index.js"]
