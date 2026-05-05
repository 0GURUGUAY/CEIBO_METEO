# Deploy Backend On Fly.io

Cette application se deploye plus naturellement sur Fly pour le backend, et sur Vercel ou ailleurs pour le frontend.

Le backend actuel lance un scheduler en memoire au demarrage du process. C'est compatible avec Fly, mais pas avec un hebergement serverless pur.

## 1. Authentification Fly

```bash
fly auth login
```

## 2. Creer l'application Fly

Depuis la racine du repo :

```bash
fly launch --no-deploy
```

Le repo contient deja un [fly.toml](/Users/maxpatissier/Downloads/ceibo_meteo/fly.toml) de base. Pense a ajuster la valeur `app = "ceibo-meteo-backend"` si ce nom n'est pas disponible globalement sur Fly.

Choix recommandes :

- app web Node via Dockerfile detecte a la racine
- region proche de tes utilisateurs ou de Supabase
- pas de base de donnees Fly si tu gardes Supabase
- pas de volume persistant requis

## 3. Configurer les secrets

Le backend attend au minimum les variables suivantes :

```bash
fly secrets set \
  DATABASE_URL="postgresql://...pooler.supabase.com:5432/postgres?schema=public" \
  DIRECT_URL="postgresql://...supabase.co:5432/postgres?schema=public" \
  FRONTEND_URL="https://ton-frontend.vercel.app" \
  NEXT_PUBLIC_API_BASE_URL="https://ton-app-fly.fly.dev/api"
```

Si tu utilises Telegram :

```bash
fly secrets set \
  TELEGRAM_NOTIFICATIONS_ENABLED="true" \
  TELEGRAM_BOT_TOKEN="..." \
  TELEGRAM_CHAT_ID="..." \
  TELEGRAM_SCORE_ALERT_THRESHOLD_PCT="85"
```

## 4. Ajouter la migration Prisma au release phase

Dans le fichier `fly.toml` genere par `fly launch`, ajoute :

```toml
[deploy]
  release_command = "npx prisma migrate deploy"
```

Et dans la section du service HTTP, assure-toi que l'application ecoute bien sur `4000`.

Exemple minimal utile :

```toml
app = "ton-app-fly"
primary_region = "mad"

[build]

[env]
  PORT = "4000"

[deploy]
  release_command = "npx prisma migrate deploy"

[http_service]
  internal_port = 4000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]
```

`min_machines_running = 1` est important ici, parce que le scheduler tourne dans le process Node du backend.

## 5. Deployer

```bash
fly deploy
```

## 6. Verifier

```bash
fly status
fly logs
curl https://ton-app-fly.fly.dev/api/health
```

La reponse attendue est :

```json
{"ok":true}
```

## 7. Brancher le frontend

Dans Vercel, configure :

```bash
NEXT_PUBLIC_API_BASE_URL=https://ton-app-fly.fly.dev/api
```

Puis redeploie le frontend.

## Notes importantes

- `DATABASE_URL` doit pointer vers le pooler Supabase.
- `DIRECT_URL` doit pointer vers l'URL directe Supabase pour Prisma migrate.
- Le scheduler backend ne survivra pas si l'instance scale a zero.
- Si plus tard tu veux plusieurs instances Fly, il faudra sortir le scheduler du process web pour eviter les doublons.