# Relais de Flux Twitch

Cette application permet de relayer un flux Twitch via un serveur distant. Elle accepte un lien M3U8 et le diffuse en continu.

## Prérequis

- Node.js (version 14 ou supérieure)
- npm (gestionnaire de paquets Node.js)

## Installation

1. Clonez ce dépôt
2. Installez les dépendances :
```bash
npm install
```

## Utilisation

1. Démarrez le serveur :
```bash
npm start
```

2. Ouvrez votre navigateur à l'adresse `http://localhost:3000`

3. Dans l'interface, collez l'URL du flux M3U8 que vous souhaitez diffuser

4. Le flux sera automatiquement chargé et diffusé en continu

## Notes importantes

- Assurez-vous d'avoir les droits nécessaires pour diffuser le contenu
- Le serveur doit être accessible depuis l'extérieur pour que d'autres utilisateurs puissent voir le flux
- Pour une utilisation en production, considérez l'utilisation d'un reverse proxy comme Nginx 