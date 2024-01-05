FROM node:latest
RUN apt-get update && apt-get install -y tree
RUN mkdir -p /usr/bin
COPY sandbox/bin/* /usr/bin
RUN chmod +x /usr/bin/*