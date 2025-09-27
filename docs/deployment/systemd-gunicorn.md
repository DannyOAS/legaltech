# Deploying with systemd + Gunicorn

The frontend Vite build runs separately, so the backend only needs a WSGI server. These steps assume the project lives in `/opt/legaltech` with a Python virtualenv at `/opt/legaltech/.venv`. Adjust paths to match your host.

## 1. Install system dependencies

```bash
sudo apt update
sudo apt install python3.12-venv python3-pip nginx
```

## 2. Create the project user and directory

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin legaltech
sudo mkdir -p /opt/legaltech
sudo chown -R $USER:legaltech /opt/legaltech
```

Clone the repo into `/opt/legaltech`, create a virtualenv, and install backend deps:

```bash
cd /opt/legaltech
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements-dev.txt  # or requirements.txt for prod
```

## 3. Configure environment variables

Copy the `.env` template shipped in this repo and adjust secrets:

```bash
cp backend/.env backend/.env.production
vi backend/.env.production
```

Make sure the CORS/CSRF entries match the domain you’ll serve the frontend from.

## 4. Install the systemd unit

Copy the service file into `/etc/systemd/system/` and adjust paths if needed:

```bash
sudo cp devops/systemd/legaltech.service /etc/systemd/system/legaltech.service
sudo vi /etc/systemd/system/legaltech.service  # tweak PATH, WorkingDirectory, etc.
```

Inside the unit you’ll see the following variables that should match your environment:

- `User` / `Group`: account that will run Gunicorn (create one if it doesn’t exist).
- `WorkingDirectory`: points to `/opt/legaltech/backend`.
- `Environment`: virtualenv path.
- `EnvironmentFile`: where your `.env` lives.
- `ExecStart`: gunicorn command. Adjust worker count or bind address if you use TCP instead of Unix sockets.

Create the runtime directory expected by the unit:

```bash
sudo mkdir -p /run/legaltech
sudo chown legaltech:legaltech /run/legaltech
```

Then enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable legaltech
sudo systemctl start legaltech
sudo systemctl status legaltech
```

Check Gunicorn logs via `journalctl -u legaltech -f`.

## 5. Configure Nginx as a reverse proxy

Create `/etc/nginx/sites-available/legaltech` with something like:

```nginx
server {
    listen 80;
    server_name legaltech.local;  # update

    location /static/ {
        alias /opt/legaltech/backend/staticfiles/;
    }

    location /media/ {
        alias /opt/legaltech/backend/media/;
    }

    location /api/ {
        proxy_pass http://unix:/run/legaltech/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/legaltech /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Frontend build

Build the Vite frontend and serve it via nginx (or another static host):

```bash
cd /opt/legaltech/frontend
npm install
npm run build
sudo mkdir -p /var/www/legaltech
sudo cp -r dist/* /var/www/legaltech/
```

Add another nginx server block (or extend the previous one) to serve the static `dist` directory and proxy `/api/` to Gunicorn.

## 7. Ongoing operations

- Restart backend: `sudo systemctl restart legaltech`
- Tail logs: `journalctl -u legaltech -f`
- Collect static files whenever you change them: `python manage.py collectstatic`
- Renew TLS if you add HTTPS (e.g. via certbot)

This setup keeps the Django API up continuously with systemd + gunicorn while nginx handles static assets and proxies API requests.
