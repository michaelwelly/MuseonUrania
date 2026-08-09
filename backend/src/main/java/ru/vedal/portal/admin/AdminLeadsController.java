package ru.vedal.portal.admin;

import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import ru.vedal.portal.crm.LeadRepository;

@Controller
@RequestMapping("/admin/leads")
public class AdminLeadsController {

    private final LeadRepository leads;

    public AdminLeadsController(LeadRepository leads) {
        this.leads = leads;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public String list(Model model) {
        model.addAttribute("leads", leads.findAllByOrderByCreatedAtDesc());
        return "admin/leads";
    }
}
