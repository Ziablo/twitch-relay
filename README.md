# Serveur de Relais Twitch

Ce projet permet de relayer un flux vidéo M3U8 vers votre chaîne Twitch. Il utilise FFmpeg pour lire le flux source et le rediffuser sur Twitch.

## Prérequis

- Node.js (v14 ou supérieur)
- FFmpeg doit être installé sur le serveur
- Une clé de stream Twitch

## Configuration

1. Clonez ce dépôt :
```
git clone https://github.com/Ziablo/twitch-relay.git
cd twitch-relay
```

2. Installez les dépendances :
```
npm install
```

3. Créez un fichier `.env` à la racine du projet avec votre clé de stream Twitch :
```
TWITCH_STREAM_KEY=votre_clé_de_stream_ici
```

## Utilisation

1. Démarrez le serveur localement :
```
npm start
```

2. Accédez à `http://localhost:3000` dans votre navigateur
3. Entrez l'URL du flux M3U8 que vous souhaitez relayer
4. Cliquez sur "Démarrer le Stream"

## Problèmes courants et solutions

### 1. Le flux ne démarre pas sur Twitch

Si vous utilisez un lien M3U8 de Twitch (comme ceux commençant par `https://usher.ttvnw.net/`), ces liens sont temporaires et authentifiés pour une IP spécifique. Ils ne sont généralement pas conçus pour être relayés.

**Solutions possibles :**
- Utilisez un flux M3U8 public (non-Twitch)
- Essayez un lien direct de type RTMP plutôt qu'un M3U8
- Vérifiez les logs dans l'interface pour voir les erreurs spécifiques

### 2. Erreurs FFmpeg

Si vous voyez des erreurs liées à FFmpeg, vérifiez que :
- FFmpeg est correctement installé sur votre machine ou serveur
- Sur Heroku, le buildpack FFmpeg est configuré correctement

### 3. Déploiement sur Heroku

Pour déployer sur Heroku, suivez ces étapes :

1. Créez une application Heroku
2. Ajoutez les buildpacks suivants (dans cet ordre) :
   - `heroku/nodejs`
   - `https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git`
3. Configurez la variable d'environnement `TWITCH_STREAM_KEY`
4. Déployez l'application

### 4. Logs et débogage

L'application comporte maintenant une section de logs visible dans l'interface. Utilisez ces logs pour diagnostiquer les problèmes. Les erreurs sont affichées en rouge.

### 5. Limites de Heroku

Heroku a des limitations qui peuvent affecter les applications de streaming :
- Les dynos redémarrent toutes les 24 heures
- Les connexions peuvent être interrompues après un certain temps
- Le streaming continu pendant de longues périodes peut être difficile

Pour un usage professionnel, envisagez d'utiliser un VPS dédié ou un service cloud comme DigitalOcean, AWS ou Azure.

## Support

Si vous rencontrez des problèmes, vous pouvez :
1. Consulter les logs dans l'interface
2. Sur Heroku, utilisez `heroku logs --tail` pour voir les logs du serveur
3. Créer une issue sur GitHub

## Licence

MIT
