package ru.vedal.portal.crm;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InteractionRepository extends JpaRepository<Interaction, UUID> {

    List<Interaction> findByDealIdOrderByAtDesc(UUID dealId);

    List<Interaction> findByClientIdOrderByAtDesc(UUID clientId);

    List<Interaction> findByLeadIdOrderByAtDesc(UUID leadId);
}
