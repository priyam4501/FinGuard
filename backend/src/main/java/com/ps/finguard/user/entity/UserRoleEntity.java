package com.ps.finguard.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.util.UUID;

@Entity
@Table(name = "user_roles", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "role"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserRoleEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Type(AppRoleType.class)
    @Column(nullable = false, columnDefinition = "app_role")
    private AppRole role;
}
