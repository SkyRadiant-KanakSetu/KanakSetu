-- Seed a few institutions
INSERT INTO institutions (name, pan, bank_account, gold_wallet_id) VALUES
('Shree Siddhivinayak Temple Trust', 'ABCDE1234F', 'SBI-XXXX-1234', 'WALLET-SIDDHI'),
('Tirumala Tirupati Devasthanams', 'PQRSX4321Z', 'AndhraBank-XXXX-5678', 'WALLET-TIRUMALA'),
('Akshaya Patra Foundation', 'AAACT1234A', 'HDFC-XXXX-9012', 'WALLET-AKSHAYA')
ON CONFLICT DO NOTHING;
