package com.ps.finguard.profile.service;

import com.ps.finguard.common.AppException;
import com.ps.finguard.profile.dto.UpdateProfileRequest;
import com.ps.finguard.profile.dto.UserResponse;
import com.ps.finguard.profile.mapper.UserMapper;
import com.ps.finguard.user.entity.UserEntity;
import com.ps.finguard.user.repository.UserRepository;
import com.ps.finguard.user.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserMapper userMapper;

    @Transactional
    public UserResponse update(UUID userId, UpdateProfileRequest req) {
        UserEntity user = userRepository.findById(userId).orElseThrow(() -> AppException.notFound("User"));
        user.setFullName(req.fullName().trim());
        String url = req.avatarUrl();
        user.setAvatarUrl(url == null || url.isBlank() ? null : url.trim());
        List<String> roles = userRoleRepository.findAllByUserId(user.getId())
                .stream().map(r -> r.getRole().name()).toList();
        return userMapper.toResponse(user, roles);
    }
}
