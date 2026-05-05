# Deploy Frontend On Vercel

Le frontend vit dans le dossier `frontend`.

Pour Vercel, il faut deployer ce sous-dossier comme projet Next.js et le faire pointer vers le backend Fly.

## 1. Creer le projet Vercel

Dans Vercel :

- importe le repository Git
- choisis `frontend` comme `Root Directory`
- laisse le preset `Next.js`

## 2. Variables d'environnement

Ajoute au minimum :

```bash
NEXT_PUBLIC_API_BASE_URL=https://ceibo-meteo-backend.fly.dev/api
NEXT_PUBLIC_DEMO_MODE=false
```

Remplace le domaine Fly si ton nom d'app final est different.

## 3. Build settings

Si Vercel detecte automatiquement `frontend` comme app Next.js, tu peux laisser les commandes par defaut.

Sinon utilise :

```bash
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

## 4. Redeployer apres le backend

Quand l'URL Fly du backend est connue et repond sur `/api/health`, redeploie le frontend pour injecter la bonne valeur de `NEXT_PUBLIC_API_BASE_URL`.

## 5. Verification

Controle ces points :

- la page d'accueil se charge
- les requetes XHR partent bien vers `https://...fly.dev/api`
- aucune erreur CORS n'apparait

## Notes importantes

- Le backend autorise l'origine definie dans `FRONTEND_URL`, donc cette variable cote Fly doit correspondre exactement a l'URL Vercel finale.
- Si tu changes de domaine Vercel, pense a mettre a jour aussi `FRONTEND_URL` sur Fly.
- Le frontend n'a pas besoin d'etre conteneurise pour Vercel.