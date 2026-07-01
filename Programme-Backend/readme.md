# Objectif

Créer une architecture orientée messages en Java utilisant RabbitMQ pour automatiser le traitement des fichiers MP3. L'architecture est composée de trois programmes distincts communiquant par des files d'attente pour découpler la détection, l'extraction de métadonnées et l'envoi vers une API web.

## Questions Ouvertes / Éléments à Confirmer

> [!IMPORTANT]
> Avant de commencer le développement, merci de valider les points suivants :
> 1. **Dossier à surveiller** : Quel est le chemin du dossier local où les fichiers MP3 seront déposés (ex: `C:/Musiques`) ? Nous pouvons le rendre configurable.
> 2. **URL de l'API Web** : L'URL cible pour l'upload est-elle bien `http://localhost:8080/api/mp3/upload` ou avez-vous un serveur spécifique ?
> 3. **RabbitMQ** : Les paramètres par défaut (localhost, port 5672, user/pass: guest/guest) sont-ils suffisants pour le développement ?
> 4. **Structure du projet** : Je propose de créer un seul projet Maven contenant trois classes `Main` distinctes pour simplifier la compilation, est-ce que cela vous convient ?

## Changements Proposés

Le projet sera un projet Maven standard utilisant Java (version 11+ recommandée pour `HttpClient`).

### Configuration du projet (Maven)
#### [NEW] pom.xml
Ajout des dépendances nécessaires :
- `com.rabbitmq:amqp-client` : Pour la communication avec RabbitMQ.
- `com.mpatric:mp3agic` : Bibliothèque robuste et légère pour l'extraction des métadonnées MP3.
- `com.google.code.gson:gson` : Pour la sérialisation et désérialisation des messages JSON.

---

### Classes Communes
#### [NEW] src/main/java/com/gestionplaylist/utils/RabbitMQUtil.java
Gestion de la connexion à RabbitMQ et déclaration des files (`Queue_Nouveaux_MP3`, `Queue_Meta_MP3`).

#### [NEW] src/main/java/com/gestionplaylist/utils/SimpleLogger.java
Utilitaire sur mesure pour écrire les logs dans les fichiers spécifiques (`log_programme1.txt`, `log_programme2.txt`, `log_programme3.txt`) avec le format de date requis `[HH:mm:ss]`.

#### [NEW] src/main/java/com/gestionplaylist/models/Mp3Message.java
#### [NEW] src/main/java/com/gestionplaylist/models/Mp3MetadataMessage.java
Classes représentant la structure des messages JSON échangés dans les files.

---

### Programme 1 : Producteur (Surveillance du Répertoire)
#### [NEW] src/main/java/com/gestionplaylist/Programme1Watcher.java
- Utilisation de `java.nio.file.WatchService` pour surveiller la création de nouveaux fichiers `.mp3`.
- Envoi du chemin absolu en JSON vers `Queue_Nouveaux_MP3`.
- Écriture des événements dans `log_programme1.txt`.

---

### Programme 2 : Extracteur (Consommateur / Producteur)
#### [NEW] src/main/java/com/gestionplaylist/Programme2Extractor.java
- Consomme les messages de `Queue_Nouveaux_MP3`.
- Utilise `mp3agic` pour lire les tags ID3 (Titre, Artiste, Album, Genre, Année, Commentaire, Durée).
- Envoie un nouveau message JSON enrichi vers `Queue_Meta_MP3`.
- Écriture des résultats/erreurs dans `log_programme2.txt`.

---

### Programme 3 : Intégration API (Consommateur Final)
#### [NEW] src/main/java/com/gestionplaylist/Programme3Uploader.java
- Consomme les messages de `Queue_Meta_MP3`.
- Construit une requête HTTP POST multipart (`java.net.http.HttpClient`) pour envoyer le fichier physique et les métadonnées vers `/api/mp3/upload`.
- Si succès (ex: HTTP 200/201), supprime le fichier MP3 local (`Files.delete()`).
- Si échec, le fichier est conservé en local et un `basicNack` peut être renvoyé à RabbitMQ pour une tentative ultérieure.
- Écriture des opérations dans `log_programme3.txt`.

## Plan de Vérification

### Tests Automatisés / Manuels
1. Démarrer RabbitMQ localement.
2. Lancer les 3 programmes simultanément dans des terminaux séparés.
3. Déposer un fichier `.mp3` de test dans le répertoire cible.
4. Vérifier que le Programme 1 détecte et publie l'événement.
5. Vérifier que le Programme 2 extrait les bonnes métadonnées (visibles dans les logs).
6. Vérifier que le Programme 3 tente l'upload HTTP (l'API de destination peut être un mock comme httpbin.org ou un serveur local pour le test).
7. Vérifier la suppression du fichier en cas de succès, ou sa conservation en cas d'échec.

# Guide d'Utilisation : Système de Traitement MP3 avec RabbitMQ

L'architecture asynchrone pour le traitement des fichiers MP3 a été implémentée avec succès en utilisant Java et RabbitMQ.

## Architecture Implémentée

Le système est composé de trois programmes distincts qui s'exécutent indépendamment et communiquent uniquement via les files RabbitMQ :

1. **Programme 1 (Watcher)** : Surveille le répertoire `C:/Musiques`. Dès qu'un fichier `.mp3` est ajouté, il envoie un message (JSON contenant le chemin absolu) dans la file `Queue_Nouveaux_MP3`.
2. **Programme 2 (Extracteur)** : Écoute la file `Queue_Nouveaux_MP3`. Il lit le fichier, extrait ses métadonnées (ID3v1 / ID3v2) à l'aide de la librairie `mp3agic`, et publie un message enrichi dans la file `Queue_Meta_MP3`.
3. **Programme 3 (Uploader API)** : Écoute la file `Queue_Meta_MP3`. Il construit une requête HTTP multipart contenant le fichier MP3 et ses métadonnées au format JSON, et l'envoie vers `http://localhost:8080/api/mp3/upload`. En cas de succès HTTP 200, le fichier local est supprimé.

> [!TIP]
> Chacun de ces programmes dispose de son propre fichier de log pour tracer les événements et erreurs : `log_programme1.txt`, `log_programme2.txt` et `log_programme3.txt`.

## Dépendances

Le projet est basé sur Maven (Java 11+) et inclut :
- `com.rabbitmq:amqp-client` (RabbitMQ)
- `com.mpatric:mp3agic` (Extraction MP3)
- `com.google.code.gson:gson` (JSON)

## Comment Tester le Système

1. **Prérequis** : Assurez-vous d'avoir RabbitMQ démarré en local (paramètres par défaut : localhost, 5672, guest/guest).
2. **Compilation** : À la racine du dossier `Programme-Backend`, exécutez `mvn clean compile`.
3. **Exécution** : Vous pouvez lancer les 3 programmes en même temps dans trois terminaux différents à la racine du projet :
   - `mvn exec:java -Dexec.mainClass="com.gestionplaylist.Programme1Watcher"`
   - `mvn exec:java -Dexec.mainClass="com.gestionplaylist.Programme2Extractor"`
   - `mvn exec:java -Dexec.mainClass="com.gestionplaylist.Programme3Uploader"`
4. **Déclencher un événement** : Déposez un fichier `.mp3` dans le répertoire `C:/Musiques`.
5. **Vérification** : Observez les fichiers de logs (`log_programmeX.txt`) pour valider la détection, l'extraction et l'envoi HTTP !
