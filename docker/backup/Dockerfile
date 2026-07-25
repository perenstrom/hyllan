FROM postgres:17-alpine

RUN apk add --no-cache dcron rclone

COPY backup.sh /usr/local/bin/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh

# Foreground, logging to stderr so `docker compose logs` captures cron's own
# output; backup.sh redirects its own output to the container's stdout/stderr.
CMD ["crond", "-f", "-d", "8"]
