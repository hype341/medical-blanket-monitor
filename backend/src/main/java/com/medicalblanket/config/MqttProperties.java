package com.medicalblanket.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "blanket.mqtt")
public class MqttProperties {
    private boolean enabled = true;
    private String url = "tcp://127.0.0.1:1883";
    private String observerClientId = "blanket-spring-observer";
    private String observerUsername = "blanket-device";
    private String observerPassword = "";
    private String alarmObserverClientId = "blanket-spring-alarm-observer";
    private String publisherClientId = "blanket-spring-publisher";
    private String publisherUsername = "blanket-publisher";
    private String publisherPassword = "";
    private String dataTopic = "medical-blanket/v1/+/+/+/sensor/+/data";
    private String alarmTopic = "medical-blanket/v1/H001/+/+/alarm";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getObserverClientId() { return observerClientId; }
    public void setObserverClientId(String observerClientId) { this.observerClientId = observerClientId; }
    public String getObserverUsername() { return observerUsername; }
    public void setObserverUsername(String observerUsername) { this.observerUsername = observerUsername; }
    public String getObserverPassword() { return observerPassword; }
    public void setObserverPassword(String observerPassword) { this.observerPassword = observerPassword; }
    public String getAlarmObserverClientId() { return alarmObserverClientId; }
    public void setAlarmObserverClientId(String alarmObserverClientId) { this.alarmObserverClientId = alarmObserverClientId; }
    public String getPublisherClientId() { return publisherClientId; }
    public void setPublisherClientId(String publisherClientId) { this.publisherClientId = publisherClientId; }
    public String getPublisherUsername() { return publisherUsername; }
    public void setPublisherUsername(String publisherUsername) { this.publisherUsername = publisherUsername; }
    public String getPublisherPassword() { return publisherPassword; }
    public void setPublisherPassword(String publisherPassword) { this.publisherPassword = publisherPassword; }
    public String getDataTopic() { return dataTopic; }
    public void setDataTopic(String dataTopic) { this.dataTopic = dataTopic; }
    public String getAlarmTopic() { return alarmTopic; }
    public void setAlarmTopic(String alarmTopic) { this.alarmTopic = alarmTopic; }
}
