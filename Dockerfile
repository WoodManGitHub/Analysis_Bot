FROM node:14-buster-slim
RUN apt update
RUN apt -y upgrade
RUN apt -y install git
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production && mv node_modules ../
COPY . .
EXPOSE 8080
CMD ["node", "./dist/index.js"]
