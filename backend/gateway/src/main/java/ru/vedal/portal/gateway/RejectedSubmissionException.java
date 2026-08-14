package ru.vedal.portal.gateway;

// Заявка отклонена на входе, и причина наружу не раскрывается: подробность
// «сработала ловушка» — подсказка тому, кто её обходит.
public class RejectedSubmissionException extends RuntimeException {

    public RejectedSubmissionException(String message) {
        super(message);
    }
}
