package com.ps.finguard.profile.mapper;

import com.ps.finguard.profile.dto.UserResponse;
import com.ps.finguard.user.entity.UserEntity;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {

    default UserResponse toResponse(UserEntity u, List<String> roles) {
        if (u == null) return null;
        return new UserResponse(u.getId(), u.getEmail(), u.getFullName(), u.getAvatarUrl(), roles);
    }
}
