package com.ps.finguard.invite.entity;

import com.ps.finguard.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.util.UUID;

@Entity
@Table(name = "group_invites")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupInviteEntity extends BaseEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "group_id", nullable = false, columnDefinition = "uuid")
    private UUID groupId;

    @Column(name = "invited_email", nullable = false)
    private String invitedEmail;

    @Column(name = "invited_by", nullable = false, columnDefinition = "uuid")
    private UUID invitedBy;

    @Type(InviteStatusType.class)
    @Column(nullable = false, columnDefinition = "invite_status")
    private InviteStatus status;
}
