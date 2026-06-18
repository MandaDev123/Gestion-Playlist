docker run -d --name mon-rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

mvn exec:java "-Dexec.mainClass=com.gestionplaylist.Programme1Watcher"

mvn exec:java "-Dexec.mainClass=com.gestionplaylist.Programme2Extractor"

mvn exec:java "-Dexec.mainClass=com.gestionplaylist.Programme3Uploader"

