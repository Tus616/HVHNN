package com.hvhn.backend.model;

public class EmergencyContact {
    private String name;
    private String phone;
    private String email;
    private String relation; // Family, Friend, Colleague

    public EmergencyContact() {}

    public EmergencyContact(String name, String phone, String email, String relation) {
        this.name = name;
        this.phone = phone;
        this.email = email;
        this.relation = relation;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRelation() { return relation; }
    public void setRelation(String relation) { this.relation = relation; }
}
