package com.ps.finguard.auth.service;

import com.ps.finguard.auth.dto.AuthResponse;
import com.ps.finguard.auth.dto.SignInRequest;
import com.ps.finguard.auth.dto.SignUpRequest;
import com.ps.finguard.common.AppException;
import com.ps.finguard.profile.dto.UserResponse;
import com.ps.finguard.profile.mapper.UserMapper;
import com.ps.finguard.security.JwtService;
import com.ps.finguard.user.entity.AppRole;
import com.ps.finguard.user.entity.UserEntity;
import com.ps.finguard.user.entity.UserRoleEntity;
import com.ps.finguard.user.repository.UserRepository;
import com.ps.finguard.user.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserMapper userMapper;

    @Transactional
    public AuthResponse signUp(SignUpRequest req) {
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw AppException.conflict("An account with this email already exists");
        }
        UserEntity user = UserEntity.builder()
                .email(email)
                .fullName(req.fullName().trim())
                .passwordHash(passwordEncoder.encode(req.password()))
                .build();
        user = userRepository.save(user);
        userRoleRepository.save(UserRoleEntity.builder().userId(user.getId()).role(AppRole.USER).build());
        log.info("New user signed up: {}", user.getId());
        return buildResponse(user, List.of(AppRole.USER.name()));
    }

    @Transactional(readOnly = true)
    public AuthResponse signIn(SignInRequest req) {
        String email = req.email().trim().toLowerCase();
        UserEntity user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }
        List<String> roles = userRoleRepository.findAllByUserId(user.getId())
                .stream().map(r -> r.getRole().name()).toList();
        if (roles.isEmpty()) roles = List.of(AppRole.USER.name());
        log.info("User signed in: {}", user.getId());
        return buildResponse(user, roles);
    }

    @Transactional(readOnly = true)
    public UserResponse me(java.util.UUID userId) {
        UserEntity user = userRepository.findById(userId).orElseThrow(() -> AppException.notFound("User"));
        List<String> roles = userRoleRepository.findAllByUserId(user.getId())
                .stream().map(r -> r.getRole().name()).toList();
        return userMapper.toResponse(user, roles);
    }

    private AuthResponse buildResponse(UserEntity user, List<String> roles) {
        String token = jwtService.issue(user.getId(), user.getEmail(), roles);
        return new AuthResponse(token, jwtService.expirySeconds(), userMapper.toResponse(user, roles));
    }
}
