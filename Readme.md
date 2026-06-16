# Projet : Gestion et Streaming de Fichiers MP3

## Technologies utilisées

### Backend Desktop

* Java
* RabbitMQ (Message Broker)

### Backend Web

* Java Spring Boot (API REST)

### Frontend

* React.js

---

# 1. Partie Backend Desktop

L'objectif de cette partie est d'automatiser le traitement des fichiers MP3 déposés dans un répertoire local.

L'architecture repose sur une programmation orientée messages (Event-Driven Architecture) utilisant RabbitMQ afin de découpler les traitements et éviter les appels synchrones entre les différents programmes.

## Architecture Générale

Programme 1 → Queue_Nouveaux_MP3 → Programme 2 → Queue_Meta_MP3 → Programme 3 → API Web

Chaque programme communique uniquement via des files d'attente RabbitMQ.

---

## Programme 1 : Surveillance du Répertoire (Producteur)

### Rôle

Le programme surveille en permanence un répertoire local destiné au dépôt de nouveaux fichiers musicaux.

### Fonctionnement

* Écoute en continu un dossier spécifique.
* Détecte l'arrivée de nouveaux fichiers.
* Accepte uniquement les fichiers au format MP3.
* Affiche à l'écran les nouveaux fichiers détectés.
* Produit un message dans RabbitMQ contenant les informations du fichier détecté.

### Entrée

* Répertoire local contenant les fichiers MP3.

### Sortie

Liste des nouveaux fichiers détectés :

* Nom du fichier
* Chemin absolu du fichier

Exemple :

```json
{
  "path": "C:/Musiques/song.mp3"
}
```

Message envoyé dans :

```text
Queue_Nouveaux_MP3
```

### Gestion des logs

Toutes les actions sont enregistrées dans un fichier :

```text
log_programme1.txt
```

Exemples :

```text
[10:25:30]
Nouveau fichier détecté : song.mp3
```

```text
[10:25:45]
Erreur : accès refusé au fichier song.mp3
```

---

## Programme 2 : Extraction des Métadonnées (Consommateur / Producteur)

### Rôle

Le programme récupère les fichiers détectés par le Programme 1 et extrait automatiquement les métadonnées MP3 à l'aide d'une bibliothèque spécialisée.

### Fonctionnement

* Consomme les messages provenant de Queue_Nouveaux_MP3.
* Lit le fichier MP3.
* Extrait les métadonnées audio.

### Paramètres d'entrée

* Liste des fichiers MP3.
* Chemin complet du fichier.

### Métadonnées extraites

* Titre
* Artiste
* Album
* Genre
* Date / Année
* Commentaire
* Durée

### Sortie

Pour chaque MP3, un objet contenant :

```json
{
  "path":"C:/Musiques/song.mp3",
  "title":"Titre",
  "artist":"Artiste",
  "album":"Album",
  "genre":"Pop",
  "year":"2024",
  "comment":"Commentaire",
  "duration":240
}
```

Message envoyé dans :

```text
Queue_Meta_MP3
```

### Gestion des logs

Toutes les opérations sont enregistrées dans :

```text
log_programme2.txt
```

Exemple :

```text
[10:30:12]
Extraction effectuée sur song.mp3

Titre : Hello
Artiste : Adele
Album : 25
Genre : Pop
Durée : 295 secondes
```

En cas d'erreur :

```text
[10:30:15]
Erreur lors de l'extraction des métadonnées.
```

---

## Programme 3 : Intégration API et Nettoyage (Consommateur Final)

### Rôle

Le programme envoie les fichiers MP3 ainsi que leurs métadonnées vers l'application Web.

### Fonctionnement

* Consomme les messages provenant de Queue_Meta_MP3.
* Appelle une API REST.
* Transfère :

  * Le fichier MP3.
  * Les métadonnées associées.

### Paramètres d'entrée

* Fichier MP3.
* Chemin du fichier.
* Métadonnées extraites.

### Traitement

Envoi vers :

```http
POST /api/mp3/upload
```

### Gestion des logs

Les opérations sont enregistrées dans :

```text
log_programme3.txt
```

Exemple :

```text
[10:35:00]
Début d'envoi du fichier song.mp3
```

```text
[10:35:02]
Envoi réussi
```

ou

```text
[10:35:02]
Échec de l'envoi : serveur inaccessible
```

### Gestion du cycle de vie des fichiers

#### En cas de succès

Le fichier MP3 local est supprimé automatiquement :

```text
song.mp3 supprimé du répertoire local.
```

#### En cas d'échec

* Le fichier est conservé.
* Une nouvelle tentative pourra être effectuée ultérieurement.

---

# Utilisation de RabbitMQ

L'application repose sur une architecture orientée messages.

## Programme 1

* Producteur
* Envoie les messages vers Queue_Nouveaux_MP3.

## Programme 2

* Consommateur de Queue_Nouveaux_MP3.
* Producteur de Queue_Meta_MP3.

## Programme 3

* Consommateur de Queue_Meta_MP3.

### Avantages

* Découplage des traitements.
* Meilleure tolérance aux pannes.
* Traitement asynchrone.
* Évolutivité du système.

---

# 2. Partie Web

La partie Web permet de gérer et d'exploiter les fichiers MP3 importés.

## Technologies

### Backend

* Java Spring Boot
* API REST

### Frontend

* React.js

### Base de données

* PostgreSQL ou MySQL

---

# Gestion des MP3 (CRUD)

L'application doit permettre :

### Création

Ajout de nouveaux morceaux.

### Lecture

Consultation de la liste des musiques.

### Modification

Modification des métadonnées :

* Titre
* Artiste
* Album
* Genre
* Langue
* Date
* Commentaire
* Durée

Cette fonctionnalité est particulièrement utile lorsque certaines métadonnées n'ont pas été extraites automatiquement.

### Suppression

Suppression d'un morceau de la base de données.

---

# Génération de Playlists

L'utilisateur peut générer automatiquement une playlist selon plusieurs critères.

## Critères disponibles

* Langue
* Genre musical
* Artiste
* Album
* Date / Année
* Commentaire
* Durée totale souhaitée

### Exemple

Créer une playlist :

* Genre : Pop
* Artiste : Adele
* Durée totale : 1 heure

Le système génère automatiquement une playlist correspondante.

---

# Modification de la Playlist Générée

Après génération :

* L'utilisateur visualise la playlist.
* Il peut remplacer certains morceaux.
* Il peut réorganiser l'ordre des chansons.

Lorsque le résultat lui convient :

* Il clique sur « Accepter ».

La playlist est alors validée.

---

# Sauvegarde des Playlists

Chaque playlist validée peut être enregistrée.

Informations sauvegardées :

* Nom de la playlist.
* Date de création.
* Utilisateur propriétaire.
* Liste des morceaux.

Chaque utilisateur dispose de son espace personnel pour retrouver ses playlists.

---

# Lecteur Audio

Chaque playlist peut être écoutée directement depuis l'application.

Fonctionnalités :

* Lecture (Play)
* Pause
* Morceau suivant
* Morceau précédent
* Barre de progression
* Lecture continue de la playlist

---

# Téléchargement des Playlists

L'utilisateur peut télécharger une playlist complète.

Format :

```text
ZIP
```

Le fichier ZIP contient tous les morceaux MP3 de la playlist.

Exemple :

```text
Playlist_Relax.zip

├── musique1.mp3
├── musique2.mp3
├── musique3.mp3
└── musique4.mp3
```

---

# Résultat attendu

Le système permet :

* L'import automatique des MP3.
* L'extraction automatique des métadonnées.
* La communication asynchrone via RabbitMQ.
* La gestion complète des morceaux.
* La génération intelligente de playlists.
* La sauvegarde des playlists par utilisateur.
* L'écoute des playlists en streaming.
* Le téléchargement des playlists au format ZIP.
