import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { invitationsApi } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

const roleLabels = {
  ADMIN: "Administrador",
  EMPLOYEE: "Funcionário",
};

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();

  const {
    data: invite,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => invitationsApi.getByToken(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full p-8 text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Convite Inválido</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Este convite não existe ou é inválido.
          </p>
          <Button onClick={() => navigate("/login")}>Ir para Login</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Sua conta já foi criada!</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Você foi convidado como{" "}
          <Badge variant="outline" className="mx-1">
            {roleLabels[invite.role] || invite.role}
          </Badge>
          {invite.company && (
            <>
              {" "}
              na empresa <strong>{invite.company.name}</strong>
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Verifique seu email <strong>{invite.email}</strong> para obter sua
          senha provisória de acesso. Após o primeiro login, troque sua senha em{" "}
          <strong>Configurações</strong>.
        </p>
        <Button onClick={() => navigate("/login")} className="w-full">
          Ir para Login
        </Button>
      </Card>
    </div>
  );
}
