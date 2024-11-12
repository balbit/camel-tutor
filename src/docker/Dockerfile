FROM ocaml/opam:alpine-ocaml-5.2

RUN sudo apk update && sudo apk add linux-headers

RUN adduser -D -h /home/user user && \
    chown -R user:user /home/user

RUN opam init -y --bare && \
    eval $(opam env) && \
    opam switch create 5.2.0 && \
    eval $(opam env) && \
    opam install -y core core_bench utop

RUN echo '#require "core.top";;' > /home/user/.ocamlinit && \
    echo '#require "ppx_jane";;' >> /home/user/.ocamlinit && \
    echo 'open Base;;' >> /home/user/.ocamlinit

USER user
