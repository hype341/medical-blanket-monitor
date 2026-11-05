package com.medicalblanket;

import com.medicalblanket.config.MqttProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(MqttProperties.class)
public class BlanketBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BlanketBackendApplication.class, args);
	}

}
