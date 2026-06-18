package com.gestionplaylist;

import com.gestionplaylist.models.Mp3Message;
import com.gestionplaylist.models.Mp3MetadataMessage;
import com.gestionplaylist.utils.RabbitMQUtil;
import com.gestionplaylist.utils.SimpleLogger;
import com.google.gson.Gson;
import com.mpatric.mp3agic.ID3v1;
import com.mpatric.mp3agic.ID3v2;
import com.mpatric.mp3agic.Mp3File;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.DeliverCallback;

import java.io.File;
import java.nio.charset.StandardCharsets;

public class Programme2Extractor {

    private static final String LOG_FILE = "log_programme2.txt";
    private static final SimpleLogger logger = new SimpleLogger(LOG_FILE);
    private static final Gson gson = new Gson();

    public static void main(String[] args) {
        logger.log("Démarrage du Programme 2 (Extracteur)");

        try {
            Connection connection = RabbitMQUtil.createConnection();
            Channel channel = connection.createChannel();

            RabbitMQUtil.declareQueues(channel);
            logger.log("Connecté à RabbitMQ. En attente de messages dans : " + RabbitMQUtil.QUEUE_NOUVEAUX_MP3);

            DeliverCallback deliverCallback = (consumerTag, delivery) -> {
                String messageJson = new String(delivery.getBody(), StandardCharsets.UTF_8);
                
                try {
                    Mp3Message mp3Message = gson.fromJson(messageJson, Mp3Message.class);
                    File file = new File(mp3Message.getPath());
                    
                    if (!file.exists()) {
                        logger.log("Erreur : le fichier n'existe plus " + mp3Message.getPath());
                        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
                        return;
                    }

                    Mp3File mp3file = new Mp3File(file.getAbsolutePath());
                    Mp3MetadataMessage metaMsg = new Mp3MetadataMessage();
                    metaMsg.setPath(file.getAbsolutePath().replace("\\", "/"));
                    metaMsg.setDuration(mp3file.getLengthInSeconds());

                    if (mp3file.hasId3v2Tag()) {
                        ID3v2 id3v2Tag = mp3file.getId3v2Tag();
                        metaMsg.setTitle(id3v2Tag.getTitle() != null ? id3v2Tag.getTitle() : "Inconnu");
                        metaMsg.setArtist(id3v2Tag.getArtist() != null ? id3v2Tag.getArtist() : "Inconnu");
                        metaMsg.setAlbum(id3v2Tag.getAlbum() != null ? id3v2Tag.getAlbum() : "Inconnu");
                        metaMsg.setGenre(id3v2Tag.getGenreDescription() != null ? id3v2Tag.getGenreDescription() : "Inconnu");
                        metaMsg.setYear(id3v2Tag.getYear() != null ? id3v2Tag.getYear() : "Inconnue");
                        metaMsg.setComment(id3v2Tag.getComment() != null ? id3v2Tag.getComment() : "");

                        // EXTRACTION SÉCURISÉE DES BALISES VIA LES FRAMESETS (ID3v2)
                        String langueExtraite = null;
                        String dateExtraite = null;

                        java.util.Map<String, com.mpatric.mp3agic.ID3v2FrameSet> frameSets = id3v2Tag.getFrameSets();
                        if (frameSets != null) {
                            // 1. Langue (TLAN)
                            com.mpatric.mp3agic.ID3v2FrameSet tlanSet = frameSets.get("TLAN");
                            if (tlanSet != null && !tlanSet.getFrames().isEmpty()) {
                                byte[] bytes = tlanSet.getFrames().get(0).getData();
                                if (bytes != null) {
                                    String raw = new String(bytes, StandardCharsets.UTF_8).trim();
                                    langueExtraite = raw.replaceAll("[^a-zA-Z0-9]", "");
                                }
                            }

                            // 2. Date précise de sortie (TDAT ou TDRC)
                            com.mpatric.mp3agic.ID3v2FrameSet tdatSet = frameSets.get("TDAT");
                            if (tdatSet == null) {
                                tdatSet = frameSets.get("TDRC");
                            }
                            if (tdatSet != null && !tdatSet.getFrames().isEmpty()) {
                                byte[] bytes = tdatSet.getFrames().get(0).getData();
                                if (bytes != null) {
                                    String raw = new String(bytes, StandardCharsets.UTF_8).trim();
                                    dateExtraite = raw.replaceAll("[^0-9\\-/]", "");
                                }
                            }
                        }

                        metaMsg.setLangue(langueExtraite != null && !langueExtraite.isEmpty() ? langueExtraite : "Inconnue");
                        metaMsg.setReleaseDate(dateExtraite != null && !dateExtraite.isEmpty() ? dateExtraite : (id3v2Tag.getYear() != null ? id3v2Tag.getYear() : "Inconnue"));

                    } else if (mp3file.hasId3v1Tag()) {
                        ID3v1 id3v1Tag = mp3file.getId3v1Tag();
                        metaMsg.setTitle(id3v1Tag.getTitle() != null ? id3v1Tag.getTitle() : "Inconnu");
                        metaMsg.setArtist(id3v1Tag.getArtist() != null ? id3v1Tag.getArtist() : "Inconnu");
                        metaMsg.setAlbum(id3v1Tag.getAlbum() != null ? id3v1Tag.getAlbum() : "Inconnu");
                        metaMsg.setGenre(id3v1Tag.getGenreDescription() != null ? id3v1Tag.getGenreDescription() : "Inconnu");
                        metaMsg.setYear(id3v1Tag.getYear() != null ? id3v1Tag.getYear() : "Inconnue");
                        metaMsg.setComment(id3v1Tag.getComment() != null ? id3v1Tag.getComment() : "");
                        
                        // ID3v1 ne gère pas ces champs
                        metaMsg.setLangue("Inconnue");
                        metaMsg.setReleaseDate(id3v1Tag.getYear() != null ? id3v1Tag.getYear() : "Inconnue");
                    } else {
                        metaMsg.setTitle(file.getName());
                        metaMsg.setArtist("Inconnu");
                        metaMsg.setAlbum("Inconnu");
                        metaMsg.setGenre("Inconnu");
                        metaMsg.setYear("Inconnue");
                        metaMsg.setComment("");
                        metaMsg.setLangue("Inconnue");
                        metaMsg.setReleaseDate("Inconnue");
                    }

                    // Journalisation (Log) mise à jour avec les nouveaux attributs
                    StringBuilder logBuilder = new StringBuilder();
                    logBuilder.append("Extraction effectuée sur ").append(file.getName()).append("\n\n");
                    logBuilder.append("Titre : ").append(metaMsg.getTitle()).append("\n");
                    logBuilder.append("Artiste : ").append(metaMsg.getArtist()).append("\n");
                    logBuilder.append("Album : ").append(metaMsg.getAlbum()).append("\n");
                    logBuilder.append("Genre : ").append(metaMsg.getGenre()).append("\n");
                    logBuilder.append("Langue : ").append(metaMsg.getLangue()).append("\n");
                    logBuilder.append("Date de sortie : ").append(metaMsg.getReleaseDate()).append("\n");
                    logBuilder.append("Durée : ").append(metaMsg.getDuration()).append(" secondes");
                    logger.log(logBuilder.toString());

                    // Publish to Queue_Meta_MP3
                    String metaJson = gson.toJson(metaMsg);
                    channel.basicPublish("", RabbitMQUtil.QUEUE_META_MP3, null, metaJson.getBytes(StandardCharsets.UTF_8));
                    
                    // Ack message from Queue_Nouveaux_MP3
                    channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);

                } catch (Exception e) {
                    logger.log("Erreur lors de l'extraction des métadonnées pour le message: " + messageJson);
                    e.printStackTrace();
                    channel.basicReject(delivery.getEnvelope().getDeliveryTag(), false); 
                }
            };

            channel.basicConsume(RabbitMQUtil.QUEUE_NOUVEAUX_MP3, false, deliverCallback, consumerTag -> { });

        } catch (Exception e) {
            logger.log("Erreur critique : " + e.getMessage());
            e.printStackTrace();
        }
    }
}