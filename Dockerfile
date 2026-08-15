FROM node:22-alpine

RUN apk add --no-cache python3 make g++ tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo Asia/Shanghai > /etc/timezone

WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://mirrors.cloud.tencent.com/npm/ && \
    npm install && \
    npm cache clean --force

COPY . .

RUN npm run build

EXPOSE 80

CMD ["node", "server-start-cloudbase.cjs"]
