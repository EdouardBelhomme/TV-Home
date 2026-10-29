# TV-Home

Écran d'accueil épuré pour TV Samsung (Tizen), installé comme une vraie appli (`.wgt`).

- Horloge et date discrètes
- Photo plein écran (6 au choix) et dock sobre avec les logos des applis, dans l'esprit de [CleanFrame](https://github.com/nthnclrk/CleanFrame)
- Applis pilotables à la télécommande, dont YouTube sans pub via TizenBrew / TizenTube

## Comment ça marche

L'appli installée sur la TV ([`wgt/`](wgt/)) est une coquille : à chaque démarrage, elle charge
[`app/`](app/) depuis la branche `main` de ce dépôt. **Un push sur `main` met la TV à jour** au
prochain lancement de l'appli (GitHub met jusqu'à 5 minutes à servir la nouvelle version).
Sans internet, elle utilise la copie d'`app/` intégrée au paquet.

## Installer ou réinstaller l'appli

À ne refaire que si [`wgt/`](wgt/) change. Depuis WSL, avec `cryptography`, `lxml`, `pillow` et
`adb-shell` dans `~/tvctl-lib` :

1. Certificat d'auteur, une seule fois (`CA_DIR` contient `tizen-developer-ca.cer`,
   `tizen-developer-ca-privatekey.pem` et `conf.ini` du paquet `certificate-generator` de Tizen) :
   ```
   python3 -I tools/sign_wgt.py make-author --ca-dir CA_DIR --out ~/tvwork/certs
   ```
   et copier `tizen-distributor-signer.p12` du même paquet dans `~/tvwork/certs`.
2. Sur la TV : mode développeur activé, **IP du PC hôte** = l'IP de l'ordinateur, puis redémarrage.
3. Construire, signer et installer :
   ```
   bash tools/build_wgt.sh
   python3 -I tools/install_wgt.py <IP de la TV> dist/TV-Home.wgt TVHomeEdou
   ```
4. Remettre l'IP du PC hôte sur `127.0.0.1` pour que TizenBrew fonctionne.

Le certificat public des développeurs Tizen expire le 1er janvier 2027 : une installation après
cette date pourrait être refusée.

## Télécommande

| Touche | Action |
| --- | --- |
| Flèches / OK | Naviguer / ouvrir l'appli |
| Jaune | Réorganiser : OK sur une tuile pour la déplacer, la masquer ou la réafficher |
| Haut | Boutons Fond d'écran, Toutes les applis et Réglages |
| Bleu | Photo de fond suivante |
| Rouge | Diagnostic |

## Modifier les applis

Les tuiles sont définies dans [`app/apps.js`](app/apps.js). `id` est l'identifiant Samsung de
l'appli ; l'appli l'ouvre avec l'API Tizen.

## Aperçu sur ordinateur

```
python3 -m http.server 4795
```

Ouvre ensuite `http://localhost:4795/app/index.html` dans une fenêtre de 1920×1080. Les touches
`y`, `b` et `r` remplacent le jaune, le bleu et le rouge.
