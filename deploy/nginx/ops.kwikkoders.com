server {
    listen 80;
    server_name ops.kwikkoders.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ops.kwikkoders.com;

    ssl_certificate     /etc/letsencrypt/live/ops.kwikkoders.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ops.kwikkoders.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Uploaded files served directly from disk
    location /uploads/ {
        alias /var/www/erpgkk/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Socket.IO WebSocket — must be above /api/ and /
    location /socket.io/ {
        proxy_pass         http://localhost:3003/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # NestJS API
    location /api/ {
        proxy_pass         http://localhost:3003/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 25M;
    }

    # Next.js frontend
    location / {
        proxy_pass         http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
