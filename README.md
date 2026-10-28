# Atelier AI — plateforme de formation

Site très simple : page d'accueil, paiement MonCash / NatCash (vérifié à la main), espace élève, page admin.
Hébergé sur Netlify (projet `atelier-ai-0max`). Les données sont dans Netlify Blobs (store `atelier`).

## Pages

| Adresse | Pour qui | Rôle |
| --- | --- | --- |
| `/` | tout le monde | présentation, prix (1 500 goud), bouton « Mwen vle kòmanse » |
| `/peye` | élève | numéro MonCash/NatCash + formulaire (nom, WhatsApp, e-mail, n° de transaction) |
| `/espas?k=…` | élève validé | les 2 vidéos, le lien d'essai Claude, le dépôt du skill, le guide |
| `/admin` | toi | valider ou refuser les paiements, envoyer le lien par WhatsApp, modifier le contenu |

## Réglages Netlify (Project configuration → Environment variables)

| Variable | Exemple | Secret ? |
| --- | --- | --- |
| `ADMIN_MODPAS` | mot de passe de `/admin` (8 caractères minimum) | oui |
| `MONCASH_NIMEWO` | `3700 0000` | non |
| `NATCASH_NIMEWO` | `4100 0000` | non |
| `NON_BENEFISYE` | nom affiché sous le numéro | non |

Après un changement de variable, relancer un déploiement (Deploys → Trigger deploy).

## Comment un élève est validé

1. L'élève paie et remplit le formulaire → demande « An atant » dans `/admin`.
2. Tu vérifies dans ton appli MonCash/NatCash que l'argent est arrivé.
3. « Peman an rive — Aksepte » → un lien personnel est créé et WhatsApp s'ouvre avec le message prêt.
4. « Retire aksè » coupe le lien à tout moment.

Le contenu de l'espace élève (liens des vidéos YouTube non répertoriées, lien Claude 7 jours, etc.) se change dans l'onglet **Kontni** de `/admin`, sans redéployer.

## Développement local

```bash
npm install
npx netlify-cli dev   # avec un fichier .env contenant les variables ci-dessus
```
