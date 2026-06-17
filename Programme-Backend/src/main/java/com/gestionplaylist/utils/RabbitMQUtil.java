package com.gestionplaylist.utils;

import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import java.util.concurrent.TimeoutException;

public class RabbitMQUtil {
    public static final String QUEUE_NOUVEAUX_MP3 = "Queue_Nouveaux_MP3";
    public static final String QUEUE_META_MP3 = "Queue_Meta_MP3";

    public static Connection createConnection() throws IOException, TimeoutException {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost("localhost");
        factory.setPort(5672);
        factory.setUsername("guest");
        factory.setPassword("guest");
        return factory.newConnection();
    }

    public static void declareQueues(Channel channel) throws IOException {
        boolean durable = true; // Conserver les files après redémarrage
        boolean exclusive = false;
        boolean autoDelete = false;

        channel.queueDeclare(QUEUE_NOUVEAUX_MP3, durable, exclusive, autoDelete, null);
        channel.queueDeclare(QUEUE_META_MP3, durable, exclusive, autoDelete, null);
    }
}
