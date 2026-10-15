location = /health {
    access_log off;
    proxy_pass https://muse.w0x7ce.eu;
    proxy_http_version 1.1;
    proxy_set_header Host muse.w0x7ce.eu;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "";
    proxy_ssl_server_name on;
    proxy_ssl_name muse.w0x7ce.eu;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_verify_depth 5;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location = /fetch_vms {
    access_log off;
    proxy_pass https://muse.w0x7ce.eu;
    proxy_http_version 1.1;
    proxy_set_header Host muse.w0x7ce.eu;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "";
    proxy_ssl_server_name on;
    proxy_ssl_name muse.w0x7ce.eu;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_verify_depth 5;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location = /device_token/mint {
    access_log off;
    proxy_pass https://muse.w0x7ce.eu;
    proxy_http_version 1.1;
    proxy_set_header Host muse.w0x7ce.eu;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "";
    proxy_ssl_server_name on;
    proxy_ssl_name muse.w0x7ce.eu;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_verify_depth 5;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location = /device_token/refresh {
    access_log off;
    proxy_pass https://muse.w0x7ce.eu;
    proxy_http_version 1.1;
    proxy_set_header Host muse.w0x7ce.eu;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "";
    proxy_ssl_server_name on;
    proxy_ssl_name muse.w0x7ce.eu;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_verify_depth 5;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location = /v1/noise {
    access_log off;
    proxy_pass https://muse.w0x7ce.eu;
    proxy_http_version 1.1;
    proxy_set_header Host muse.w0x7ce.eu;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_ssl_server_name on;
    proxy_ssl_name muse.w0x7ce.eu;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_verify_depth 5;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
