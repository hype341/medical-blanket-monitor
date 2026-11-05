package com.medicalblanket;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = "blanket.mqtt.enabled=false")
class BlanketBackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
