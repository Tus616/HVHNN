package com.hvhn.backend.service;

import com.hvhn.backend.dto.FirebaseUserDto;

public interface FirebaseTokenVerifier {
    FirebaseUserDto verify(String idToken);
}
