package com.medicalblanket.web;

import com.medicalblanket.service.MediaHealthService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/camera-status")
public class MediaStatusController {
    private final MediaHealthService mediaHealthService;

    public MediaStatusController(MediaHealthService mediaHealthService) {
        this.mediaHealthService = mediaHealthService;
    }

    @PostMapping
    public List<MediaHealthService.ProbeResult> probe(
            @RequestBody List<MediaHealthService.ProbeRequest> requests
    ) {
        return mediaHealthService.probeBatch(requests);
    }
}
