package com.gestionplaylist;

import com.gestionplaylist.models.Mp3MetadataMessage;
import com.gestionplaylist.utils.RabbitMQUtil;
import com.gestionplaylist.utils.SimpleLogger;
import com.google.gson.Gson;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.DeliverCallback;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class Programme3Uploader {

    private static final String LOG_FILE = "log_programme3.txt";
    private static final SimpleLogger logger = new SimpleLogger(LOG_FILE);
    private static final Gson gson = new Gson();
    private static final String API_URL = "http://localhost:5000/api/songs";
    private static final HttpClient httpClient = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // Listes noires stockées en mémoire (comparaison normalisée)
    private static final Set<String> blacklistedGenres = new HashSet<>();
    private static final Set<String> blacklistedArtists = new HashSet<>();
    private static final String BLACKLIST_FILE = "C:\\Users\\HP\\OneDrive\\Documents\\GitHub\\Gestion-Playlist\\blacklist.txt";

    // Timestamp du dernier chargement de la blacklist (pour rechargement automatique)
    private static long lastBlacklistLoadTime = 0;

    public static void main(String[] args) {
        logger.log("Démarrage du Programme 3 (Intégration API)");

        // Chargement initial de la blacklist au démarrage
        loadBlacklist();

        try {
            Connection connection = RabbitMQUtil.createConnection();
            Channel channel = connection.createChannel();

            RabbitMQUtil.declareQueues(channel);
            logger.log("Connecté à RabbitMQ. En attente de messages dans : " + RabbitMQUtil.QUEUE_META_MP3);

            DeliverCallback deliverCallback = (consumerTag, delivery) -> {
                String messageJson = new String(delivery.getBody(), StandardCharsets.UTF_8);

                try {
                    Mp3MetadataMessage metaMsg = gson.fromJson(messageJson, Mp3MetadataMessage.class);
                    File file = new File(metaMsg.getPath());

                    // Rechargement automatique de la blacklist si le fichier a été modifié
                    reloadBlacklistIfUpdated();

                    if (!file.exists()) {
                        logger.log("Erreur : Fichier introuvable " + metaMsg.getPath());
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                        return;
                    }

                    // --- VÉRIFICATION DE LA BLACKLIST ---
                    if (isBlacklisted(metaMsg)) {
                        supprimerEtRejeter(file, metaMsg, channel, delivery.getEnvelope().getDeliveryTag());
                        return;
                    }
                    // ------------------------------------

                    logger.log("Début d'envoi du fichier " + file.getName() +
                            " [Artiste: " + metaMsg.getArtist() +
                            ", Genre: " + metaMsg.getGenre() +
                            ", Langue: " + metaMsg.getLangue() +
                            ", Date: " + metaMsg.getReleaseDate() + "]");

                    // Construction de la requête multipart
                    String boundary = "---" + UUID.randomUUID().toString();
                    byte[] body = buildMultipartBody(metaMsg, file, boundary);

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(API_URL))
                            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                    if (response.statusCode() >= 200 && response.statusCode() < 300) {
                        logger.log("Envoi réussi : " + file.getName());
                        Files.deleteIfExists(file.toPath());
                        logger.log(file.getName() + " supprimé du répertoire local.");
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                    } else {
                        logger.log("Échec de l'envoi : statut HTTP " + response.statusCode());
                        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, true);
                    }

                } catch (Exception e) {
                    logger.log("Échec de l'envoi : serveur inaccessible ou erreur (" + e.getMessage() + ")");
                    try {
                        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, true);
                    } catch (IOException ioException) {
                        ioException.printStackTrace();
                    }
                }
            };

            channel.basicConsume(RabbitMQUtil.QUEUE_META_MP3, false, deliverCallback, consumerTag -> {
            });

        } catch (Exception e) {
            logger.log("Erreur critique : " + e.getMessage());
            e.printStackTrace();
        }
    }

    // =========================================================================
    // BLACKLIST
    // =========================================================================

    /**
     * Nettoie une chaîne pour la comparaison :
     * - Met en minuscules
     * - Supprime les accents via décomposition Unicode
     * - Supprime les espaces invisibles, caractères de contrôle et non-imprimables
     * - Trim final
     */
    private static String normaliser(String valeur) {
        if (valeur == null) return "";
        // Décomposition Unicode (NFD) pour séparer les lettres de leurs accents
        String decomposed = Normalizer.normalize(valeur, Normalizer.Form.NFD);
        return decomposed
                .replaceAll("\\p{M}", "")              // supprime les accents
                .replaceAll("[\\p{C}\\p{Z}\\s]+", " ") // espaces invisibles et contrôles → espace simple
                .trim()
                .toLowerCase();
    }

    /**
     * Vérifie si un morceau est blacklisté par genre ou par artiste.
     * Affiche dans le log les valeurs exactes comparées pour faciliter le débogage.
     */
    private static boolean isBlacklisted(Mp3MetadataMessage metaMsg) {
        String genre  = normaliser(metaMsg.getGenre());
        String artist = normaliser(metaMsg.getArtist());

        // Log de débogage : valeurs brutes vs normalisées vs contenu de la blacklist
        logger.log("[DEBUG] Comparaison blacklist :"
                + "\n  genre  brut='" + metaMsg.getGenre() + "' -> normalise='" + genre + "'"
                + "\n  artist brut='" + metaMsg.getArtist() + "' -> normalise='" + artist + "'"
                + "\n  genres  blacklistes=" + blacklistedGenres
                + "\n  artists blacklistes=" + blacklistedArtists);

        return blacklistedGenres.contains(genre) || blacklistedArtists.contains(artist);
    }

    /**
     * Supprime le fichier .mp3 local et acquitte le message RabbitMQ sans envoi à l'API.
     */
    private static void supprimerEtRejeter(File file, Mp3MetadataMessage metaMsg,
                                            Channel channel, long deliveryTag) throws IOException {
        logger.log("BLACKLIST - Morceau rejeté : '" + file.getName() + "'"
                + " | Artiste : " + metaMsg.getArtist()
                + " | Genre : " + metaMsg.getGenre());

        boolean supprime = Files.deleteIfExists(file.toPath());

        if (supprime) {
            logger.log("Fichier supprimé : " + file.getAbsolutePath());
        } else {
            logger.log("Avertissement : le fichier était déjà absent : " + file.getAbsolutePath());
        }

        // Acquittement : message retiré définitivement de la file, sans envoi à l'API
        channel.basicAck(deliveryTag, false);
    }

    /**
     * Recharge la blacklist uniquement si le fichier a été modifié depuis le dernier chargement.
     */
    private static void reloadBlacklistIfUpdated() {
        Path path = Paths.get(BLACKLIST_FILE);
        if (!Files.exists(path)) {
            return;
        }
        try {
            long lastModified = Files.getLastModifiedTime(path).toMillis();
            if (lastModified > lastBlacklistLoadTime) {
                logger.log("Modification détectée sur la blacklist. Rechargement...");
                blacklistedGenres.clear();
                blacklistedArtists.clear();
                loadBlacklist();
            }
        } catch (IOException e) {
            logger.log("Avertissement : impossible de vérifier la date de modification de la blacklist : " + e.getMessage());
        }
    }

    /**
     * Charge le fichier de liste noire et remplit les Sets correspondants.
     * Essaie d'abord UTF-8, puis Windows-1252 (ANSI) en cas d'échec de décodage.
     */
    private static void loadBlacklist() {
        Path path = Paths.get(BLACKLIST_FILE);
        if (!Files.exists(path)) {
            logger.log("Info : Aucun fichier blacklist trouvé à : " + BLACKLIST_FILE + ". Aucun filtrage actif.");
            return;
        }

        List<String> lines = null;

        // Tentative 1 : UTF-8 (encodage recommandé)
        try {
            lastBlacklistLoadTime = Files.getLastModifiedTime(path).toMillis();
            lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            logger.log("Blacklist lue en UTF-8.");
        } catch (IOException e) {
            logger.log("Lecture UTF-8 échouée, tentative en Windows-1252 (ANSI)...");
        }

        // Tentative 2 : Windows-1252 (Notepad Windows par défaut)
        if (lines == null) {
            try {
                lines = Files.readAllLines(path, Charset.forName("windows-1252"));
                logger.log("Blacklist lue en Windows-1252.");
            } catch (IOException e) {
                logger.log("Erreur lors de la lecture du fichier de blacklist : " + e.getMessage());
                return;
            }
        }

        for (String line : lines) {
            line = line.trim();

            // Supprimer le BOM UTF-8 éventuel en début de fichier
            if (line.startsWith("\uFEFF")) {
                line = line.substring(1).trim();
            }

            // Ignorer les commentaires et lignes vides
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }

            if (line.contains("=")) {
                String[] parts = line.split("=", 2);
                String type   = parts[0].trim().toUpperCase();
                // Normaliser aussi les valeurs de la blacklist pour une comparaison cohérente
                String valeur = normaliser(parts[1]);

                switch (type) {
                    case "GENRE":
                        blacklistedGenres.add(valeur);
                        break;
                    case "ARTISTE":
                    case "ARTIST":
                        blacklistedArtists.add(valeur);
                        break;
                    default:
                        logger.log("Avertissement : type inconnu ignoré dans la blacklist : '" + type + "'");
                        break;
                }
            }
        }

        logger.log("Blacklist chargée : "
                + blacklistedGenres.size() + " genre(s) bloque(s) : " + blacklistedGenres
                + " | " + blacklistedArtists.size() + " artiste(s) bloque(s) : " + blacklistedArtists);
    }

    // =========================================================================
    // CONSTRUCTION DU CORPS MULTIPART
    // =========================================================================

    private static byte[] buildMultipartBody(Mp3MetadataMessage metaMsg, File file, String boundary)
            throws IOException {
        StringBuilder sb = new StringBuilder();

        // Métadonnées en JSON
        sb.append("--").append(boundary).append("\r\n");
        sb.append("Content-Disposition: form-data; name=\"metadata\"\r\n");
        sb.append("Content-Type: application/json\r\n\r\n");
        sb.append(gson.toJson(metaMsg)).append("\r\n");

        // Fichier audio
        sb.append("--").append(boundary).append("\r\n");
        sb.append("Content-Disposition: form-data; name=\"audio\"; filename=\"").append(file.getName()).append("\"\r\n");
        sb.append("Content-Type: audio/mpeg\r\n\r\n");

        byte[] headerBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] fileBytes   = Files.readAllBytes(file.toPath());
        byte[] footerBytes = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);

        byte[] body = new byte[headerBytes.length + fileBytes.length + footerBytes.length];
        System.arraycopy(headerBytes, 0, body, 0, headerBytes.length);
        System.arraycopy(fileBytes,   0, body, headerBytes.length, fileBytes.length);
        System.arraycopy(footerBytes, 0, body, headerBytes.length + fileBytes.length, footerBytes.length);

        return body;
    }
}