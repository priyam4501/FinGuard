package com.ps.finguard.group.mapper;

import com.ps.finguard.group.dto.GroupResponse;
import com.ps.finguard.group.entity.GroupEntity;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface GroupMapper {
    GroupResponse toResponse(GroupEntity g);
}
