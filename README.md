# TV-Home

Écran d'accueil épuré pour TV Samsung (Tizen), sous forme de module [TizenBrew](https://github.com/reisxd/TizenBrew).

- Grande horloge, date et salutation selon l'heure
- Fond animé dont l'ambiance suit le moment de la journée
- Tuiles d'applis pilotables à la télécommande, dont YouTube sans pub via TizenTube

## Installation

Dans TizenBrew, ouvre le gestionnaire de modules, ajoute un module **GitHub** et saisis :

```
EdouardBelhomme/TV-Home
```

Pour l'ouvrir automatiquement au lancement de TizenBrew, active le lancement automatique sur le module.

## Télécommande

| Touche | Action |
| --- | --- |
| Flèches / OK | Naviguer / ouvrir l'appli |
| Jaune | Réorganiser (◀ ▶ pour déplacer, OK pour masquer) |
| Bleu | Changer d'ambiance |

## Modifier les applis

Les tuiles sont définies dans [`app/apps.js`](app/apps.js). `id` est l'identifiant Samsung de l'appli : l'API locale de la TV (`127.0.0.1:8001`) s'en sert pour l'ouvrir.

## Aperçu sur ordinateur

```
python3 -m http.server 4795
```

Ouvre ensuite `http://localhost:4795/app/index.html` dans une fenêtre de 1920×1080. Les touches `y` et `b` remplacent le jaune et le bleu.
